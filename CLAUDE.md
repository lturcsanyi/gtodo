# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user PWA that treats Google Calendar events as a todo list. Pure HTML/JS/CSS — **no build step, no bundler, no package manager, no test suite, no linter**. Hosted on GitHub Pages; runs locally from any static server.

## Common commands

Local dev:
```bash
python3 -m http.server 8000
```
`http://localhost:8000` must be in the OAuth client's Authorized JavaScript origins (Google Cloud Console) or sign-in fails.

Deploy: `git push` to `main`. GitHub Pages serves from repo root.

## Architecture

Five JS files, each an IIFE that attaches a single global (`Store`, `Auth`, `Api`, `UI`, plus `app.js` which has no global). **Script load order in `index.html` matters** — `app.js` must load last; the others are referenced by name at runtime.

Boot flow (`js/app.js` → `boot()`):
1. No `clientId` in localStorage → onboarding view (paste OAuth Client ID).
2. Try cached token (`Auth.loadCachedToken`) → else silent refresh (`Auth.silentRefresh`, empty `prompt`) → else sign-in view.
3. No source/done calendars picked → calendar-picker view.
4. Otherwise → fetch events and render.

Layer responsibilities:
- **`store.js`** — localStorage settings under key `gtodo.settings.v1` (`clientId`, `sourceCalendarIds[]`, `doneCalendarId`).
- **`auth.js`** — Google Identity Services token client. Caches `{token, expiresAt}` under `gtodo.auth.v1`. Single in-flight token request tracked via `pendingResolve`/`pendingReject`. `ensureToken()` is the public entry point used by `api.js`; it auto-falls back from silent → consent prompt.
- **`api.js`** — Thin `fetch` wrapper over Calendar REST v3. `listEvents()` fans out across selected calendars in parallel, tags each event with `_calendarId`, paginates fully, sorts by start. Default window is **1000 days back, 365 days ahead** (wide, by design — the app is also a history viewer). Per-calendar failures are logged and swallowed so one bad calendar doesn't blank the list.
- **`ui.js`** — Day-grouped rendering. Headers get `data-today` / `data-future` attributes; `app.js#scrollToToday` uses these as scroll anchors. Date/time formatting is hardcoded to `'hu-HU'` locale.
- **`sw.js`** — App-shell cache, network-first for same-origin, never touches cross-origin (Google APIs/GIS pass through).

Event actions:
- **Complete** = `events.move` to the configured Done calendar (not a status change). Recurring events will likely fail because `move` acts on the series; we list with `singleEvents=true` so the event id is an instance id.
- **Delete** = `events.delete`. Works on single instances.
- **Row tap** opens `e.htmlLink` in a new tab.

## When changing JS or CSS files

Bump the cache name in `sw.js` (`const CACHE = 'gtodo-shell-vN'`) — otherwise installed PWAs keep serving stale code from the cache. If you add/remove a file in `js/` or `css/`, also update the `SHELL` array in `sw.js`.

## OAuth / deployment notes

- OAuth runs in Google's **Testing** mode (single user). Refresh tokens expire every ~7 days; user re-signs in.
- The OAuth Client ID is a public identifier — the only reason it lives in localStorage (not in the repo) is to keep the repo independent of any one user's Google project.
- Scope requested: `https://www.googleapis.com/auth/calendar` (full read/write, required for `events.move` and `events.delete`).