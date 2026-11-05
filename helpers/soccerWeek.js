// Shared "soccer week" logic so every page agrees on who is playing this week.
// Cycle: Friday 00:01 PT through Thursday 23:59 PT (game is Thursday 7pm PT).

const PT_ZONE = 'America/Los_Angeles';

function getPtParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value, 10);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

// Converts a PT wall-clock time to a UTC timestamp (handles PST and PDT).
function ptWallClockToUtc(year, month, day, hour, minute, second, ms) {
  const guess = Date.UTC(year, month, day, hour, minute, second, ms);
  const p = getPtParts(new Date(guess));
  const asIfUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second, ms);
  const offset = asIfUtc - guess; // negative: PT is behind UTC
  return guess - offset;
}

export function getSoccerWeek(now = new Date()) {
  const pt = getPtParts(now);
  // Calendar-only Date for day-of-week math (timezone-independent use of getDay via UTC)
  const todayUTCDate = new Date(Date.UTC(pt.year, pt.month, pt.day));
  const dow = todayUTCDate.getUTCDay(); // 0=Sun ... 4=Thu, 5=Fri

  let daysToThursday;
  if (dow === 5) daysToThursday = 6;
  else if (dow === 6) daysToThursday = 5;
  else if (dow === 0) daysToThursday = 4;
  else daysToThursday = 4 - dow;

  const thursday = new Date(Date.UTC(pt.year, pt.month, pt.day + daysToThursday));
  const friday = new Date(Date.UTC(pt.year, pt.month, pt.day + daysToThursday - 6));

  const startTimestamp = ptWallClockToUtc(
    friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate(), 0, 1, 0, 0
  );
  const endTimestamp = ptWallClockToUtc(
    thursday.getUTCFullYear(), thursday.getUTCMonth(), thursday.getUTCDate(), 23, 59, 59, 999
  );

  return {
    pt,
    dayOfWeek: dow,
    // Local Date with PT wall-clock fields, kept for existing callers
    todayInPT: new Date(pt.year, pt.month, pt.day, pt.hour, 0, 0, 0),
    thursdayPT: new Date(thursday.getUTCFullYear(), thursday.getUTCMonth(), thursday.getUTCDate()),
    startTimestamp,
    endTimestamp,
  };
}

export function filterToWeek(items, { startTimestamp, endTimestamp }) {
  return items.filter((item) => {
    const ts = parseInt(item.date, 10);
    return ts >= startTimestamp && ts <= endTimestamp;
  });
}

// One record per name: the most recent paid record, else the most recent record.
export function latestRecordPerName(items) {
  const grouped = items.reduce((acc, item) => {
    acc[item.name] = acc[item.name] || [];
    acc[item.name].push(item);
    return acc;
  }, {});
  return Object.values(grouped).map((group) => {
    const sorted = [...group].sort(
      (a, b) => parseInt(b.date || '0', 10) - parseInt(a.date || '0', 10)
    );
    return sorted.find((item) => item.paid) || sorted[0];
  });
}

export function getQueueTimestamp(item) {
  const queueTs = item?.paidAt || item?.createdAt || item?.date || item?.id || 0;
  return parseInt(queueTs, 10) || 0;
}

// Splits this week's records into the active white/dark rosters (max 16, latest payers bumped).
export function buildActiveTeams(weekItems) {
  const merged = latestRecordPerName(weekItems);
  merged.sort((a, b) => parseInt(a.date || '0', 10) - parseInt(b.date || '0', 10));

  const manuallyWaitlisted = merged.filter((item) => Boolean(item.manualWaitlist));
  const active = merged.filter((item) => !item.manualWaitlist);

  let whiteTeam = active.filter((item) => item.team === 'white');
  let darkTeam = active.filter((item) => item.team === 'dark');

  let autoWaitlist = [];
  const total = whiteTeam.length + darkTeam.length;
  if (total > 16) {
    const latestFirst = [...whiteTeam, ...darkTeam].sort(
      (a, b) => getQueueTimestamp(b) - getQueueTimestamp(a)
    );
    autoWaitlist = latestFirst.slice(0, total - 16);
    whiteTeam = whiteTeam.filter((item) => !autoWaitlist.includes(item));
    darkTeam = darkTeam.filter((item) => !autoWaitlist.includes(item));
  }

  return { merged, whiteTeam, darkTeam, manuallyWaitlisted, autoWaitlist };
}
