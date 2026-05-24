// Google Identity Services token-client wrapper.
// Exposes `Auth` globally.
(function () {
  // 'email' is included so we can fetch the signed-in account address once and
  // pass it as `hint` on subsequent silent refreshes. Without the hint, GIS
  // pops the account chooser whenever multiple Google accounts are signed in.
  const SCOPES = 'email https://www.googleapis.com/auth/calendar';
  const TOKEN_KEY = 'gtodo.auth.v1';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let userEmail = null;

  // Promise-resolver pattern: GIS callback fires later, we wait for it.
  let pendingResolve = null;
  let pendingReject = null;

  function isReady() {
    return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
  }

  function loadCachedToken() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return false;
      const { token, expiresAt, email } = JSON.parse(raw);
      // Email outlives the access token — keep it around so we can hint the
      // next refresh even when the cached token has expired.
      if (email) userEmail = email;
      if (!token || Date.now() >= expiresAt) return false;
      accessToken = token;
      tokenExpiresAt = expiresAt;
      return true;
    } catch { return false; }
  }

  function saveCachedToken() {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({
        token: accessToken,
        expiresAt: tokenExpiresAt,
        email: userEmail,
      }));
    } catch {}
  }

  function clearCachedToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // Poll until the GIS script has loaded.
  function whenReady() {
    return new Promise((resolve) => {
      if (isReady()) return resolve();
      const t = setInterval(() => {
        if (isReady()) { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  function init(clientId) {
    if (!clientId) throw new Error('Missing OAuth Client ID');
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          if (pendingReject) pendingReject(new Error(resp.error));
        } else {
          accessToken = resp.access_token;
          // GIS gives expires_in in seconds.
          tokenExpiresAt = Date.now() + (resp.expires_in - 60) * 1000;
          saveCachedToken();
          if (pendingResolve) pendingResolve(accessToken);
          // Fire-and-forget email fetch on first sign-in so subsequent refreshes
          // can disambiguate the account silently.
          if (!userEmail) fetchUserEmail();
        }
        pendingResolve = pendingReject = null;
      },
    });
  }

  async function fetchUserEmail() {
    if (!accessToken) return;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.email) {
        userEmail = data.email;
        saveCachedToken();
      }
    } catch {}
  }

  function requestToken(prompt) {
    return new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
      const opts = { prompt };
      // Pin the refresh to the previously-signed-in account so GIS doesn't
      // show the account chooser when multiple Google accounts are active.
      if (userEmail) opts.hint = userEmail;
      tokenClient.requestAccessToken(opts);
    });
  }

  // Interactive sign-in (shows consent if needed).
  async function signIn() {
    await whenReady();
    const settings = Store.load();
    if (!tokenClient) init(settings.clientId);
    const token = await requestToken('consent');
    // Refresh email after explicit consent — the user may have picked a
    // different account from the chooser.
    await fetchUserEmail();
    return token;
  }

  // Try silent refresh only — does NOT fall back to interactive consent.
  // Returns the token on success; throws on failure.
  async function silentRefresh() {
    await whenReady();
    const settings = Store.load();
    if (!tokenClient) init(settings.clientId);
    return requestToken('');
  }

  // Silent refresh if we have a previous session; otherwise interactive.
  async function ensureToken() {
    if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
    await whenReady();
    const settings = Store.load();
    if (!tokenClient) init(settings.clientId);
    // empty prompt = silent if previously authorized
    try {
      return await requestToken('');
    } catch {
      return await requestToken('consent');
    }
  }

  function signOut() {
    if (accessToken && isReady()) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    tokenExpiresAt = 0;
    userEmail = null;
    clearCachedToken();
  }

  function getToken() {
    return accessToken;
  }

  function getEmail() {
    return userEmail;
  }

  function isSignedIn() {
    return !!accessToken && Date.now() < tokenExpiresAt;
  }

  window.Auth = { signIn, signOut, ensureToken, silentRefresh, getToken, getEmail, isSignedIn, init, whenReady, loadCachedToken };
})();
