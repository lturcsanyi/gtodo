# gtodo

A personal productivity tool that treats your Google Calendar events as a todo list.

- Dense, Things-style list view (Today, Tomorrow, later days)
- Tap an event → opens it in Google Calendar
- **Complete** → moves the event to your "Done" calendar (`events.move`)
- **Delete** → removes the event (`events.delete`)
- Installable as a PWA on Android (and desktop)
- Pure HTML + JS, no build step, hosted on GitHub Pages

This is a single-user app. The OAuth client runs in **testing** mode with you as the only test user — no Google verification needed.

---

## 1. Google Cloud setup (one-time)

You need an OAuth 2.0 Client ID before the app can talk to Google Calendar.

### 1.1 Create a project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Top bar → project dropdown → **New Project**. Name it `gtodo` (or whatever). Create.
3. Make sure the new project is selected in the top bar.

### 1.2 Enable the Calendar API
1. Left nav → **APIs & Services** → **Library**.
2. Search for **Google Calendar API**. Open it. Click **Enable**.

### 1.3 Configure the OAuth consent screen
1. Left nav → **APIs & Services** → **OAuth consent screen**.
2. User type: **External**. Create.
3. Fill in:
   - **App name**: `gtodo` (or anything)
   - **User support email**: your email
   - **Developer contact**: your email
4. Save and continue through the "Scopes" step (you don't need to pre-declare scopes here — the app requests them at runtime).
5. **Test users** step: click **Add users**, add your own Google account email. Save.
6. The app will stay in **Testing** mode. That's fine for personal use; tokens will expire every 7 days and you'll just re-sign-in. No verification needed.

### 1.4 Create the OAuth Client ID
1. Left nav → **APIs & Services** → **Credentials**.
2. **+ Create credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `gtodo web client`.
5. **Authorized JavaScript origins** — add both:
   - `https://<your-github-username>.github.io` (for GitHub Pages)
   - `http://localhost:8000` (for local dev)
6. **Authorized redirect URIs**: leave empty. The app uses the Google Identity Services token client which doesn't use redirects.
7. Create. Copy the **Client ID** (looks like `1234567890-abc...apps.googleusercontent.com`).

You'll paste this Client ID into the app's settings on first run — it's not stored in the repo, so the repo stays safe to push public.

---

## 2. Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `gtodo`).
2. Push this folder to it:
   ```bash
   cd /Users/laszloturcsanyi/personal/git/gtodo
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:<your-username>/gtodo.git
   git push -u origin main
   ```
3. On GitHub → repo → **Settings** → **Pages**.
4. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
5. Wait a minute, then visit `https://<your-username>.github.io/gtodo/`.

---

## 3. First-run setup in the app

1. Open the app URL on your phone or desktop.
2. You'll see a settings screen. Paste the OAuth **Client ID** from step 1.4. Save.
3. Click **Sign in with Google**. Google will warn that the app isn't verified — that's expected in Testing mode. Click **Continue**.
4. Grant calendar access.
5. The settings panel will now show your calendars. Pick:
   - Which calendars to **show events from** (your work cal, personal cal, etc.)
   - Your **Done** calendar (where Complete moves events to). Create a calendar called "Done" in Google Calendar first if you don't have one.
6. Close settings. Your events appear as a todo list.

### Install as a PWA on Android
1. Open the GitHub Pages URL in Chrome on Android.
2. Menu → **Install app** (or **Add to Home Screen**).
3. Launch from the home screen — it runs full-screen like a native app.

---

## 4. Local development

Any static server works. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Make sure `http://localhost:8000` is in the **Authorized JavaScript origins** list (step 1.4) or sign-in will fail.

---

## 5. Project layout

```
gtodo/
├── index.html              # app shell
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # service worker (caches app shell)
├── icons/icon.svg          # PWA icon
├── css/style.css           # dense list styling
└── js/
    ├── app.js              # entry, orchestrates everything
    ├── auth.js             # Google Identity Services token client
    ├── api.js              # Google Calendar REST v3 wrapper
    ├── store.js            # localStorage settings
    └── ui.js               # rendering + day grouping
```

---

## 6. Notes & caveats

- **Testing mode token lifetime**: refresh tokens issued in Testing mode expire after 7 days. You'll need to sign in again roughly weekly. To get longer-lived tokens, you'd have to put the app through Google's verification process.
- **Recurring events**: when you complete a single instance of a recurring event, `events.move` may behave unexpectedly (it acts on series, not instances). For recurring events, Complete will likely error out — Delete works on the single instance because we list events with `singleEvents=true`.
- **Time zones**: events are rendered in your browser's local time zone.
- The OAuth Client ID is a **public** identifier — even if you commit it, it's not a secret. The app keeps it in localStorage just to avoid polluting the repo.