// SoccerNow trigger payment (Apps Script project owned by montagnese.alberto@gmail.com).
// Trigger: processEmails every 5 minutes. Posts $7 Venmo / Zelle payments to soccernowsf.
const PAYMENT_CONFIG = {
  API_URL: PropertiesService.getScriptProperties().getProperty('PAYMENT_API_URL') ||
    'https://soccernowsf.vercel.app/api/soccernowUpdatePayment',
  PROCESSED_LABEL: PropertiesService.getScriptProperties().getProperty('PAYMENT_PROCESSED_LABEL') ||
    'payment-stored-in-db',
  SKIPPED_LABEL: PropertiesService.getScriptProperties().getProperty('PAYMENT_SKIPPED_LABEL') ||
    'payment-skipped',
  ERROR_LABEL: PropertiesService.getScriptProperties().getProperty('PAYMENT_ERROR_LABEL') ||
    'payment-error',
  EXPECTED_AMOUNT: Number(PropertiesService.getScriptProperties().getProperty('PAYMENT_EXPECTED_AMOUNT') || 7),
  DEFAULT_TEAM: PropertiesService.getScriptProperties().getProperty('PAYMENT_DEFAULT_TEAM') || 'dark',
  MAX_THREADS: Number(PropertiesService.getScriptProperties().getProperty('PAYMENT_MAX_THREADS') || 20),
  MAX_RUN_MS: Number(PropertiesService.getScriptProperties().getProperty('PAYMENT_MAX_RUN_MS') || 4 * 60 * 1000),
  MAX_POST_ATTEMPTS: Number(PropertiesService.getScriptProperties().getProperty('PAYMENT_MAX_POST_ATTEMPTS') || 3),
  // The iPhone Shortcut forwards BofA Zelle SMS from this address with subject "Zelle text".
  ZELLE_FORWARDER: PropertiesService.getScriptProperties().getProperty('PAYMENT_ZELLE_FORWARDER') ||
    'alberto.montagnese@gmail.com',
  // Optional JSON map {"Bank Name": "Roster Name"} for Zelle names that differ from the roster.
  ZELLE_NAME_ALIASES: PropertiesService.getScriptProperties().getProperty('PAYMENT_ZELLE_NAME_ALIASES') || '{}',
  SEEN_PREFIX: 'payment_seen_',
  SEEN_TTL_DAYS: 30
};

function processEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('[payments] Another payment run is still active; exiting.');
    return;
  }

  const started = Date.now();
  try {
    processPaymentEmails_(started);
    pruneSeenMessages_();
  } finally {
    lock.releaseLock();
  }
}

function setupPaymentTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('[payments] Trigger set up to run every 5 minutes.');
}

function processPaymentEmails_(started) {
  const processedLabel = getOrCreatePaymentLabel_(PAYMENT_CONFIG.PROCESSED_LABEL);
  const skippedLabel = getOrCreatePaymentLabel_(PAYMENT_CONFIG.SKIPPED_LABEL);
  const errorLabel = getOrCreatePaymentLabel_(PAYMENT_CONFIG.ERROR_LABEL);
  const queries = [
    // Venmo changed its receipt subject to "Name paid $7.00 to your Venmo account".
    'is:unread in:inbox from:venmo@venmo.com (subject:"paid you" OR subject:"to your Venmo account")',
    'is:unread in:inbox from:bankofamerica.com subject:"sent you $"',
    // BofA Zelle SMS forwarded by the iPhone Shortcut. No inbox filter: Gmail may
    // file mail sent from your other address outside the inbox.
    'is:unread from:' + PAYMENT_CONFIG.ZELLE_FORWARDER + ' subject:"Zelle text"'
  ];
  const threadsById = {};
  queries.forEach(function(query) {
    GmailApp.search(query, 0, PAYMENT_CONFIG.MAX_THREADS).forEach(function(thread) {
      threadsById[thread.getId()] = thread;
    });
  });
  const threads = Object.keys(threadsById).map(function(id) { return threadsById[id]; });
  Logger.log('[payments] Found ' + threads.length + ' unread payment thread(s).');

  let posted = 0;
  let skipped = 0;
  let failed = 0;
  let duplicate = 0;

  for (let i = 0; i < threads.length; i++) {
    if (Date.now() - started > PAYMENT_CONFIG.MAX_RUN_MS - 30 * 1000) {
      Logger.log('[payments] Budget low; stopping at ' + i + '/' + threads.length);
      break;
    }

    const thread = threads[i];
    const messages = thread.getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (!message.isUnread()) continue;

      // Zelle has no transaction id, so every message is deduped on its Gmail message id.
      if (wasMessageSeen_(message)) {
        message.markRead();
        duplicate++;
        continue;
      }

      const parsed = parsePaymentMessage_(message);
      if (!parsed) {
        Logger.log('[payments] Could not parse payment receipt: ' + message.getSubject());
        thread.addLabel(skippedLabel);
        message.markRead();
        skipped++;
        continue;
      }

      if (parsed.money !== PAYMENT_CONFIG.EXPECTED_AMOUNT) {
        Logger.log('[payments] Amount ' + parsed.money + ' did not match expected ' + PAYMENT_CONFIG.EXPECTED_AMOUNT + '; skipping.');
        thread.addLabel(skippedLabel);
        message.markRead();
        skipped++;
        continue;
      }

      const emailTs = String(message.getDate().getTime());
      const payload = {
        // Keep these stable across retries so the server upserts one payment record.
        // The server uses `id` as the Firestore doc id (it can't parse `date` alone).
        id: emailTs,
        name: parsed.name,
        money: parsed.money,
        date: emailTs,
        goalkeeper: false,
        team: PAYMENT_CONFIG.DEFAULT_TEAM,
        paid: true,
        paymentMethod: parsed.paymentMethod
      };

      const result = postPaymentWithRetry_(payload);
      if (result.ok) {
        Logger.log('[payments] Posted ' + parsed.paymentMethod + ' payment for ' + parsed.name + ': $' + parsed.money);
        markMessageSeen_(message);
        removeLabelSafely_(thread, errorLabel);
        removeLabelSafely_(thread, skippedLabel);
        thread.addLabel(processedLabel);
        message.markRead();
        posted++;
      } else {
        Logger.log('[payments] API failed: ' + result.message);
        thread.addLabel(errorLabel);
        failed++;
      }
    }
  }

  Logger.log('[payments] Done. posted=' + posted + ' skipped=' + skipped + ' failed=' + failed + ' duplicate=' + duplicate);
}

function parsePaymentMessage_(message) {
  const subject = (message.getSubject() || '').trim();
  const sender = (message.getFrom() || '').toLowerCase();

  // Forwarded Zelle SMS: subject "Zelle text", body "BofA: <Name> sent you $7.00. STOP ..."
  // or just "<Name> sent you $7.00".
  if (/^zelle text$/i.test(subject) &&
      sender.indexOf(PAYMENT_CONFIG.ZELLE_FORWARDER.toLowerCase()) !== -1) {
    const zelle = parseZelleText_(message.getPlainBody() || message.getSnippet() || '');
    return zelle ? { name: zelle.name, money: zelle.money, paymentMethod: 'Zelle' } : null;
  }

  const match = subject.match(/^(.*?)\s+(?:paid you|sent you|paid your)\s+\$(\d+(?:\.\d{2})?)(?:\s+request)?\s*$/i) ||
    subject.match(/^(.*?)\s+paid\s+\$(\d+(?:\.\d{2})?)\s+to your Venmo account(?:\.|\s|$)/i);
  if (!match) return null;

  const name = match[1].trim();
  const money = Number(match[2]);
  if (!name || isNaN(money)) return null;

  if (sender.indexOf('@venmo.com') !== -1) {
    return { name: name, money: money, paymentMethod: 'Venmo' };
  }
  if (sender.indexOf('bankofamerica.com') !== -1) {
    return { name: normalizeZelleName_(name), money: money, paymentMethod: 'Zelle' };
  }
  return null;
}

function parseZelleText_(text) {
  // Use the line with "sent you $", and only the part after its last "BofA:".
  const line = String(text).split(/\r?\n/).filter(function(l) { return /sent you\s+\$/i.test(l); })[0];
  if (!line) return null;
  const clean = line.replace(/^.*BofA:/i, '').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.+?)\s+sent you\s+\$\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const money = Number(m[2].replace(/,/g, ''));
  const name = normalizeZelleName_(m[1]);
  if (!name || !money) return null;
  return { name: name, money: money };
}

function normalizeZelleName_(raw) {
  let words = String(raw).trim().split(/\s+/);
  // Banks often repeat a surname ("Juan Mendieta Mendieta"); drop adjacent repeats.
  words = words.filter(function(w, i) { return i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase(); });
  // ALL CAPS bank names -> Title Case.
  const name = words.map(function(w) {
    return w.length > 1 && w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w;
  }).join(' ');
  let aliases = {};
  try { aliases = JSON.parse(PAYMENT_CONFIG.ZELLE_NAME_ALIASES); } catch (e) {}
  return aliases[name] || name;
}

function wasMessageSeen_(message) {
  return !!PropertiesService.getScriptProperties().getProperty(PAYMENT_CONFIG.SEEN_PREFIX + message.getId());
}

function markMessageSeen_(message) {
  PropertiesService.getScriptProperties().setProperty(PAYMENT_CONFIG.SEEN_PREFIX + message.getId(), String(Date.now()));
}

function pruneSeenMessages_() {
  const props = PropertiesService.getScriptProperties();
  const cutoff = Date.now() - PAYMENT_CONFIG.SEEN_TTL_DAYS * 86400000;
  const all = props.getProperties();
  Object.keys(all).forEach(function(k) {
    if (k.indexOf(PAYMENT_CONFIG.SEEN_PREFIX) === 0 && Number(all[k]) < cutoff) props.deleteProperty(k);
  });
}

function postPaymentWithRetry_(payload) {
  let lastMessage = 'No request was made';
  for (let attempt = 1; attempt <= PAYMENT_CONFIG.MAX_POST_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch(PAYMENT_CONFIG.API_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true
      });
      const status = response.getResponseCode();
      const body = response.getContentText();
      if (status >= 200 && status < 300) {
        return { ok: true };
      }

      lastMessage = 'HTTP ' + status + ': ' + body.slice(0, 500);
      if (status < 500 && status !== 429) break;
    } catch (e) {
      lastMessage = e && e.stack ? e.stack : String(e);
    }

    if (attempt < PAYMENT_CONFIG.MAX_POST_ATTEMPTS) {
      Utilities.sleep(1000 * attempt);
    }
  }
  return { ok: false, message: lastMessage };
}

function getOrCreatePaymentLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function removeLabelSafely_(thread, label) {
  try {
    thread.removeLabel(label);
  } catch (e) {}
}

/** Run by hand in the editor to check the Zelle parser (posts nothing). */
function testZelleParser() {
  [
    'Juan Mendieta Mendieta sent you $7.00',
    'BofA: Juan Mendieta sent you $7.00. STOP to end account texts',
    'BofA: JOHN SMITH sent you $1,234.50. STOP to end account texts',
    'BofA: Your verification code is 123456'
  ].forEach(function(t) { Logger.log(t + ' -> ' + JSON.stringify(parseZelleText_(t))); });
}
