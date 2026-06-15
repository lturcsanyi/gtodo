/**
 * gtodo — nightly roll-forward for the Important calendar.
 *
 * Runs AS YOU on a daily time-driven trigger (script.google.com), independent
 * of the gtodo PWA. Each run moves every Important event dated today-or-earlier
 * to TOMORROW, preserving the time of day (timed) or all-day-ness (all-day).
 */

// Same value gtodo stores as `importantCalendarId`.
// Google Calendar → Settings → <calendar> → "Integrate calendar" → Calendar ID.
const IMPORTANT_CAL_ID = 'PASTE_IMPORTANT_CALENDAR_ID_HERE';

const DAY_MS = 24 * 60 * 60 * 1000;

function rollImportantForward() {
  const cal = CalendarApp.getCalendarById(IMPORTANT_CAL_ID);
  if (!cal) throw new Error('Calendar not found / not accessible: ' + IMPORTANT_CAL_ID);

  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);

  // Generous look-back for overdue items; only events starting before tomorrow.
  const events = cal.getEvents(addDays(todayStart, -730), tomorrowStart);

  let moved = 0, skipped = 0;
  for (const ev of events) {
    if (ev.isRecurringEvent()) { skipped++; continue; } // moving series instances is unsafe
    if (ev.getStartTime() >= tomorrowStart) continue;    // already in the future

    if (ev.isAllDayEvent()) {
      const s = startOfDay(ev.getAllDayStartDate());
      const e = startOfDay(ev.getAllDayEndDate());        // exclusive end
      const spanDays = Math.max(1, Math.round((e - s) / DAY_MS));
      if (spanDays === 1) ev.setAllDayDate(tomorrowStart);
      else ev.setAllDayDates(tomorrowStart, addDays(tomorrowStart, spanDays));
    } else {
      const durMs = ev.getEndTime().getTime() - ev.getStartTime().getTime();
      const newStart = atTimeOfDayOn(tomorrowStart, ev.getStartTime());
      ev.setTime(newStart, new Date(newStart.getTime() + durMs));
    }
    moved++;
  }
  console.log('rolled %s event(s) to %s; skipped %s recurring', moved, tomorrowStart, skipped);
}

/** Run ONCE to install the daily trigger (fires between 00:00–01:00, project timezone). */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'rollImportantForward')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('rollImportantForward').timeBased().everyDays(1).atHour(0).create();
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function atTimeOfDayOn(dayMidnight, timeSrc) {
  const x = new Date(dayMidnight);
  x.setHours(timeSrc.getHours(), timeSrc.getMinutes(), timeSrc.getSeconds(), timeSrc.getMilliseconds());
  return x;
}
