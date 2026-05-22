// Google Identity Services token-client wrapper.
// Exposes `Auth` globally.
(function () {
  const SCOPES = 'https://www.googleapis.com/auth/calendar';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;

  // Promise-resolver pattern: GIS callback fires later, we wait for it.
  let pendingResolve = null;
  let pendingReject = null;

  function isReady() {
    return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
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
          if (pendingResolve) pendingResolve(accessToken);
        }
        pendingResolve = pendingReject = null;
      },
    });
  }

  function requestToken(prompt) {
    return new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
      tokenClient.requestAccessToken({ prompt });
    });
  }

  // Interactive sign-in (shows consent if needed).
  async function signIn() {
    await whenReady();
    const settings = Store.load();
    if (!tokenClient) init(settings.clientId);
    return requestToken('consent');
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
  }

  function getToken() {
    return accessToken;
  }

  function isSignedIn() {
    return !!accessToken && Date.now() < tokenExpiresAt;
  }

  window.Auth = { signIn, signOut, ensureToken, getToken, isSignedIn, init, whenReady };
})();