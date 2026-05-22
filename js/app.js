// Entry point. Wires together store / auth / api / ui.
(function () {
  let calendarsCache = [];
  let eventsCache = [];

  const els = {
    refreshBtn: document.getElementById('refresh-btn'),
    todayBtn: document.getElementById('today-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    eventList: document.getElementById('event-list'),
    emptyMsg: document.getElementById('empty-msg'),
    errorMsg: document.getElementById('error-msg'),

    // onboarding
    clientIdInput: document.getElementById('client-id-input'),
    clientIdSave: document.getElementById('client-id-save'),

    // sign-in
    signinBtn: document.getElementById('signin-btn'),

    // pickcals
    sourceCalList: document.getElementById('source-cal-list'),
    doneCalSelect: document.getElementById('done-cal-select'),
    pickcalsSave: document.getElementById('pickcals-save'),

    // settings drawer
    settingsDrawer: document.getElementById('settings-drawer'),
    settingsClose: document.getElementById('settings-close'),
    settingsSave: document.getElementById('settings-save'),
    settingsSourceList: document.getElementById('settings-source-list'),
    settingsDoneSelect: document.getElementById('settings-done-select'),
    settingsClientId: document.getElementById('settings-client-id'),
    settingsClientIdSave: document.getElementById('settings-client-id-save'),
    accountInfo: document.getElementById('account-info'),
    signoutBtn: document.getElementById('signout-btn'),
  };

  function scrollToToday(behavior = 'smooth') {
    // Prefer the explicit "today" header; otherwise the next future one.
    const target =
      els.eventList.querySelector('[data-today]') ||
      els.eventList.querySelector('[data-future]');
    if (target) target.scrollIntoView({ block: 'start', behavior });
  }

  function showError(msg) {
    els.errorMsg.textContent = msg;
    els.errorMsg.classList.remove('hidden');
    setTimeout(() => els.errorMsg.classList.add('hidden'), 5000);
  }

  async function loadAndRender() {
    const settings = Store.load();
    if (!settings.sourceCalendarIds.length) {
      UI.showOnly('view-pickcals');
      return;
    }
    try {
      // Range defaults live in api.js (currently 1000 days back, 365 ahead).
      eventsCache = await Api.listEvents(settings.sourceCalendarIds);
      // Hide events that belong to the Done calendar, just in case it's in source list.
      if (settings.doneCalendarId) {
        eventsCache = eventsCache.filter(e => e._calendarId !== settings.doneCalendarId);
      }
      UI.showOnly('view-list');
      UI.renderEventList(els.eventList, eventsCache, {
        onComplete: handleComplete,
        onDelete: handleDelete,
      });
      els.emptyMsg.classList.toggle('hidden', eventsCache.length > 0);
      // Anchor scroll at today (or first upcoming day) on each load.
      scrollToToday('auto');
    } catch (err) {
      console.error(err);
      showError('Could not load events: ' + err.message);
    }
  }

  async function handleComplete(event, rowEl) {
    const settings = Store.load();
    if (!settings.doneCalendarId) {
      showError('Pick a Done calendar in settings first.');
      return;
    }
    rowEl.querySelector('.event-check').classList.add('checked');
    rowEl.classList.add('fading');
    try {
      await Api.moveEvent(event._calendarId, event.id, settings.doneCalendarId);
      setTimeout(() => rowEl.remove(), 220);
    } catch (err) {
      rowEl.querySelector('.event-check').classList.remove('checked');
      rowEl.classList.remove('fading');
      showError('Move failed: ' + err.message);
    }
  }

  async function handleDelete(event, rowEl) {
    if (!confirm(`Delete "${event.summary || '(no title)'}"? This removes it from Google Calendar.`)) return;
    rowEl.classList.add('fading');
    try {
      await Api.deleteEvent(event._calendarId, event.id);
      setTimeout(() => rowEl.remove(), 220);
    } catch (err) {
      rowEl.classList.remove('fading');
      showError('Delete failed: ' + err.message);
    }
  }

  async function refreshCalendarList() {
    calendarsCache = await Api.listCalendars();
    return calendarsCache;
  }

  async function showPickCals() {
    const settings = Store.load();
    const cals = await refreshCalendarList();
    UI.renderCalendarChecklist(els.sourceCalList, cals, settings.sourceCalendarIds);
    UI.renderCalendarSelect(els.doneCalSelect, cals, settings.doneCalendarId);
    UI.showOnly('view-pickcals');
  }

  async function openSettings() {
    const settings = Store.load();
    els.settingsClientId.value = settings.clientId;
    els.accountInfo.textContent = Auth.isSignedIn() ? 'Signed in.' : 'Not signed in.';
    els.signoutBtn.classList.toggle('hidden', !Auth.isSignedIn());

    if (Auth.isSignedIn()) {
      try {
        const cals = await refreshCalendarList();
        UI.renderCalendarChecklist(els.settingsSourceList, cals, settings.sourceCalendarIds);
        UI.renderCalendarSelect(els.settingsDoneSelect, cals, settings.doneCalendarId);
      } catch (err) {
        showError('Could not list calendars: ' + err.message);
      }
    }
    els.settingsDrawer.classList.remove('hidden');
  }

  function closeSettings() {
    els.settingsDrawer.classList.add('hidden');
  }

  // ---- Event wiring ----

  els.clientIdSave.addEventListener('click', () => {
    const id = els.clientIdInput.value.trim();
    if (!id) return;
    Store.patch({ clientId: id });
    boot();
  });

  els.signinBtn.addEventListener('click', async () => {
    try {
      await Auth.signIn();
      // After first sign-in, force calendar pick if not yet set.
      const settings = Store.load();
      if (!settings.sourceCalendarIds.length || !settings.doneCalendarId) {
        await showPickCals();
      } else {
        await loadAndRender();
      }
    } catch (err) {
      showError('Sign-in failed: ' + err.message);
    }
  });

  els.pickcalsSave.addEventListener('click', async () => {
    const sourceCalendarIds = UI.getCheckedIds(els.sourceCalList);
    const doneCalendarId = els.doneCalSelect.value;
    if (!sourceCalendarIds.length) {
      showError('Pick at least one source calendar.');
      return;
    }
    if (!doneCalendarId) {
      showError('Pick a Done calendar.');
      return;
    }
    Store.patch({ sourceCalendarIds, doneCalendarId });
    await loadAndRender();
  });

  els.refreshBtn.addEventListener('click', () => loadAndRender());
  els.todayBtn.addEventListener('click', () => scrollToToday('smooth'));
  els.settingsBtn.addEventListener('click', () => openSettings());
  els.settingsClose.addEventListener('click', closeSettings);
  els.settingsDrawer.addEventListener('click', (e) => {
    if (e.target === els.settingsDrawer) closeSettings();
  });

  els.settingsSave.addEventListener('click', async () => {
    const sourceCalendarIds = UI.getCheckedIds(els.settingsSourceList);
    const doneCalendarId = els.settingsDoneSelect.value;
    Store.patch({ sourceCalendarIds, doneCalendarId });
    closeSettings();
    await loadAndRender();
  });

  els.settingsClientIdSave.addEventListener('click', () => {
    const id = els.settingsClientId.value.trim();
    if (!id) return;
    Store.patch({ clientId: id });
    alert('Client ID updated. Reload the app.');
    location.reload();
  });

  els.signoutBtn.addEventListener('click', () => {
    Auth.signOut();
    closeSettings();
    boot();
  });

  // ---- Boot ----

  async function boot() {
    const settings = Store.load();
    if (!settings.clientId) {
      UI.showOnly('view-onboarding');
      return;
    }
    await Auth.whenReady();
    Auth.init(settings.clientId);

    // 1) Reuse a still-valid cached access token (no network).
    // 2) Else try silent refresh (no UI if user has prior consent + active Google session).
    // 3) Else show the sign-in button.
    if (!Auth.loadCachedToken()) {
      try {
        await Auth.silentRefresh();
      } catch {
        UI.showOnly('view-signin');
        return;
      }
    }

    if (!settings.sourceCalendarIds.length || !settings.doneCalendarId) {
      await showPickCals();
      return;
    }
    await loadAndRender();
  }

  boot();
})();