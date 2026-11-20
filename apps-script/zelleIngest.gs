/**
 * Zelle -> SoccerNowSF payments.
 *
 * Runs in the Apps Script project of montagnese.alberto@gmail.com (the inbox
 * that receives the payment emails). An iPhone Shortcut forwards BofA Zelle
 * SMS to that inbox as an email with subject "Zelle text" and a body like:
 *   "BofA: Juan Mendieta sent you $7.00. STOP to end account texts"
 *   "Juan Mendieta Mendieta sent you $7.00"
 *
 * Each message is parsed for payer name + amount and posted to
 * /api/soccernowUpdatePayment, the same endpoint the Venmo flow uses.
 *
 * Dedupe (Zelle texts have no transaction id):
 *  1. Every handled Gmail message id is stored in script properties.
 *  2. The payment's id sent to the API is the email's timestamp in ms, so a
 *     retry of the same email overwrites the same Firestore doc instead of
 *     creating a second one.
 *  3. The thread gets the "zelle-processed" label (all its messages handled).
 *
 * Setup: paste this file into the project, run setupZelleTrigger() once.
 * Optional script properties:
 *   SOCCER_API_BASE   default https://soccernowsf.vercel.app
 *   ZELLE_AMOUNTS     comma list of amounts to post, default "7"
 *   ZELLE_NAME_ALIASES JSON map {"Bank Name": "Roster Name"}
 *   ZELLE_DRY_RUN     "true" logs instead of posting
 */

const ZELLE = {
  API_BASE: prop_('SOCCER_API_BASE', 'https://soccernowsf.vercel.app'),
  QUERY: 'subject:"Zelle text" newer_than:14d -label:zelle-processed',
  PROCESSED_LABEL: 'zelle-processed',
  SKIPPED_LABEL: 'zelle-skipped',
  AMOUNTS: prop_('ZELLE_AMOUNTS', '7').split(',').map(function(s) { return Number(s.trim()); }),
  DRY_RUN: prop_('ZELLE_DRY_RUN', 'false') === 'true',
  SEEN_PREFIX: 'zelle_seen_',
  SEEN_TTL_DAYS: 30
};

function prop_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v === null || v === '' ? fallback : v;
}

function setupZelleTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'zelleIngest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('zelleIngest').timeBased().everyMinutes(5).create();
  Logger.log('zelleIngest trigger created: every 5 minutes.');
}

function zelleIngest() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const processed = labelFor_(ZELLE.PROCESSED_LABEL);
    const threads = GmailApp.search(ZELLE.QUERY, 0, 20);
    let posted = 0, seen = 0, skipped = 0, failed = 0;

    threads.forEach(function(thread) {
      let threadOk = true;
      thread.getMessages().forEach(function(msg) {
        const r = handleZelleMessage_(msg);
        if (r === 'posted') posted++;
        else if (r === 'seen') seen++;
        else if (r === 'skipped') skipped++;
        else { failed++; threadOk = false; }
      });
      // Only close the thread when every message in it is handled, so a
      // failed post is retried next run. Gmail threads repeated "Zelle text"
      // emails together, which is why we walk every message, not the last.
      if (threadOk) thread.addLabel(processed);
    });

    pruneSeen_();
    Logger.log('[zelle] threads=' + threads.length + ' posted=' + posted +
      ' seen=' + seen + ' skipped=' + skipped + ' failed=' + failed);
  } catch (e) {
    Logger.log('[zelle] FATAL ' + (e && e.stack ? e.stack : e));
  } finally {
    lock.releaseLock();
  }
}

/** Returns 'posted' | 'seen' | 'skipped' | 'failed'. */
function handleZelleMessage_(msg) {
  const props = PropertiesService.getScriptProperties();
  const seenKey = ZELLE.SEEN_PREFIX + msg.getId();
  if (props.getProperty(seenKey)) return 'seen';

  const parsed = parseZelleText(msg.getPlainBody() || msg.getSnippet() || '');
  if (!parsed) {
    Logger.log('[zelle] no payment in message ' + msg.getId() + ': ' + (msg.getSnippet() || '').slice(0, 120));
    markSeen_(seenKey);
    return 'skipped';
  }
  if (ZELLE.AMOUNTS.indexOf(parsed.amount) === -1) {
    Logger.log('[zelle] skip amount $' + parsed.amount + ' from ' + parsed.name);
    markSeen_(seenKey);
    msg.getThread().addLabel(labelFor_(ZELLE.SKIPPED_LABEL));
    return 'skipped';
  }

  const payload = {
    id: String(msg.getDate().getTime()),
    name: parsed.name,
    money: parsed.amount,
    paid: true,
    paymentMethod: 'Zelle'
  };

  if (ZELLE.DRY_RUN) {
    Logger.log('[zelle] DRY RUN would post ' + JSON.stringify(payload));
    return 'posted';
  }

  const res = UrlFetchApp.fetch(ZELLE.API_BASE + '/api/soccernowUpdatePayment', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    markSeen_(seenKey);
    Logger.log('[zelle] posted ' + parsed.name + ' $' + parsed.amount + ' id=' + payload.id);
    return 'posted';
  }
  Logger.log('[zelle] HTTP ' + code + ' for ' + parsed.name + ': ' + res.getContentText().slice(0, 300));
  return 'failed';
}

/**
 * Parses "BofA: <Name> sent you $7.00. STOP to end account texts" or
 * "<Name> sent you $7.00". Returns {name, amount} or null.
 */
function parseZelleText(text) {
  // Look at the line holding "sent you $", and only after its last "BofA:".
  const line = String(text).split(/\r?\n/).filter(function(l) { return /sent you\s+\$/i.test(l); })[0];
  if (!line) return null;
  const clean = line.replace(/^.*BofA:/i, '').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.+?)\s+sent you\s+\$\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const amount = Number(m[2].replace(/,/g, ''));
  if (!amount) return null;
  return { name: normalizeName_(m[1]), amount: amount };
}

function normalizeName_(raw) {
  let words = String(raw).replace(/^BofA:\s*/i, '').trim().split(/\s+/);
  // Banks often repeat a surname ("Juan Mendieta Mendieta"); drop adjacent repeats.
  words = words.filter(function(w, i) { return i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase(); });
  // ALL CAPS bank names -> Title Case.
  let name = words.map(function(w) {
    return w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w;
  }).join(' ');
  let aliases = {};
  try { aliases = JSON.parse(prop_('ZELLE_NAME_ALIASES', '{}')); } catch (e) {}
  return aliases[name] || name;
}

function markSeen_(key) {
  PropertiesService.getScriptProperties().setProperty(key, String(Date.now()));
}

function pruneSeen_() {
  const props = PropertiesService.getScriptProperties();
  const cutoff = Date.now() - ZELLE.SEEN_TTL_DAYS * 86400000;
  const all = props.getProperties();
  Object.keys(all).forEach(function(k) {
    if (k.indexOf(ZELLE.SEEN_PREFIX) === 0 && Number(all[k]) < cutoff) props.deleteProperty(k);
  });
}

function labelFor_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/** Run by hand in the editor to check the parser. */
function testParseZelleText() {
  [
    'Juan Mendieta Mendieta sent you $7.00',
    'BofA: Juan Mendieta sent you $7.00. STOP to end account texts',
    'BofA: JOHN SMITH sent you $1,234.50. STOP to end account texts',
    'BofA: Your verification code is 123456'
  ].forEach(function(t) { Logger.log(t + ' -> ' + JSON.stringify(parseZelleText(t))); });
}
