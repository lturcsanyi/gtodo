# apps-script — nightly Important roll-forward

A standalone [Google Apps Script](https://script.google.com) that runs **as you**
on a daily trigger and moves unfinished **Important** todos forward so they never
get buried in the past.

The gtodo PWA can't do this itself — it only runs when a tab is open. Apps Script
runs server-side on a schedule, and because it runs as your own account it needs
no OAuth client and is **not** affected by the PWA's 7-day token expiry.

## What it does

Each run, for every event in the Important calendar dated **today or earlier**:

- moves it to **tomorrow**;
- **timed** events keep their time of day and duration (`14:00` → tomorrow `14:00`);
- **all-day** events stay all-day on tomorrow, span preserved;
- **recurring** events are skipped (moving a series/instance is unsafe);
- idempotent — re-running the same day moves nothing further.

Completed todos have already left this calendar (gtodo's *Complete* moves them to
the Done calendar), so everything still here is genuinely unfinished.

## Setup (one time)

1. **Calendar ID:** Google Calendar → the Important calendar's *Settings* →
   *Integrate calendar* → copy **Calendar ID**
   (`…@group.calendar.google.com`, or your address if it's the primary calendar).
   Use the calendar ID of whichever calendar you want rolled forward (in gtodo,
   that's one of the calendars you've set up as a tab).
2. **New project:** go to `script.google.com` → *New project*.
3. Paste `Code.gs`; set `IMPORTANT_CAL_ID` to the value from step 1.
4. **Timezone:** Project Settings (gear) → enable "Show appsscript.json", then
   paste `appsscript.json` (or set the timezone in the Settings UI). This must
   match your timezone — "today/tomorrow/midnight" are computed in it.
5. **Authorize:** run `rollImportantForward` once from the editor and approve the
   Calendar permission. Confirm the calendar changes look right.
6. **Schedule:** run `installTrigger` once to create the daily trigger
   (fires 00:00–01:00). Alternatively use the Triggers ⏰ panel:
   time-driven → day timer → *Midnight to 1am*.

## Verify

- After step 5, check that overdue items moved to tomorrow with times preserved.
- The editor's *Executions* panel logs `rolled N event(s)…` per run.
- Re-running `rollImportantForward` should log `rolled 0` (idempotent).

## Notes

- **Recurring Important events are not rolled** (skipped by design). If you rely
  on those, this needs series-exception handling — not currently implemented.
- Deployment is manual copy-paste; this folder keeps the source under version
  control. (`clasp` could push it from here, but the project avoids extra tooling.)
