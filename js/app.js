// Entry point. Wires together store / auth / api / ui.
(function () {
  let calendarsCache = [];
  let calendarsById = new Map();
  let colorsCache = null;
  let eventsCache = [];
  let currentTab = ''; // calendarId of the active tab

  // Per-event color: event.colorId wins, else the source calendar's color.
  function colorFor(event) {
    const evColorId = event.colorId;
    if (evColorId && colorsCache && colorsCache.event && colorsCache.event[evColorId]) {
      return colorsCache.event[evColorId].background;
    }
    const cal = calendarsById.get(event._calendarId);
    return cal ? cal.colorBackground : 'transparent';
  }

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
    pickcalsTabs: document.getElementById('pickcals-tabs'),
    pickcalsAddTab: document.getElementById('pickcals-add-tab'),
    doneCalSelect: document.getElementById('done-cal-select'),
    pickcalsSave: document.getElementById('pickcals-save'),

    // settings drawer
    settingsDrawer: document.getElementById('settings-drawer'),
    settingsClose: document.getElementById('settings-close'),
    settingsSave: document.getElementById('settings-save'),
    settingsTabs: document.getElementById('settings-tabs'),
    settingsAddTab: document.getElementById('settings-add-tab'),
    settingsDoneSelect: document.getElementById('settings-done-select'),
    settingsClientId: document.getElementById('settings-client-id'),
    settingsClientIdSave: document.getElementById('settings-client-id-save'),
    accountInfo: document.getElementById('account-info'),
    signoutBtn: document.getElementById('signout-btn'),

    // tab bar (buttons built dynamically)
    tabbar: document.getElementById('tabbar'),
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
    if (!settings.tabs.length) {
      UI.showOnly('view-pickcals');
      return;
    }
    try {
      const idsToFetch = settings.tabs.map(t => t.calendarId);
      // Fetch events, calendars, and the color palette in parallel.
      // Calendars + palette are needed to resolve per-event colors for the row accent.
      const [events, _cals, _colors] = await Promise.all([
        Api.listEvents(idsToFetch),
        refreshCalendarList(),
        colorsCache ? Promise.resolve(colorsCache) : Api.getColors().then(c => { colorsCache = c; return c; }),
      ]);
      eventsCache = events;

      // Finish migration from the old model: fill any blank tab names from the
      // calendar list, then persist once so this stops running.
      let namesChanged = false;
      for (const t of settings.tabs) {
        if (!t.name) {
          const cal = calendarsById.get(t.calendarId);
          t.name = (cal && cal.summary) || t.calendarId;
          namesChanged = true;
        }
      }
      if (namesChanged) Store.patch({ tabs: settings.tabs });

      UI.showOnly('view-list');
      buildTabbar(settings.tabs, settings.defaultCalendarId);
      renderCurrentTab();
    } catch (err) {
      console.error(err);
      showError('Could not load events: ' + err.message);
    }
  }

  function buildTabbar(tabs, defaultCalendarId) {
    const ids = tabs.map(t => t.calendarId);
    // Keep the current tab if still valid; otherwise fall back to the configured
    // default, then the first tab. (Cold start has currentTab === '', so a full
    // reload always lands on the default.)
    if (!ids.includes(currentTab)) {
      currentTab = ids.includes(defaultCalendarId) ? defaultCalendarId : ids[0];
    }
    els.tabbar.innerHTML = '';
    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (t.calendarId === currentTab ? ' active' : '');
      btn.dataset.tab = t.calendarId;
      btn.textContent = t.name || t.calendarId;
      els.tabbar.appendChild(btn);
    }
    // A single-tab bar adds nothing; only show it once there's a choice.
    const visible = tabs.length >= 2;
    els.tabbar.classList.toggle('hidden', !visible);
    document.body.classList.toggle('has-tabbar', visible);
  }

  function renderCurrentTab() {
    const list = eventsCache.filter(e => e._calendarId === currentTab);
    UI.renderEventList(els.eventList, list, {
      onComplete: handleComplete,
      onDelete: handleDelete,
      colorFor,
    });
    els.emptyMsg.textContent = 'No events. ✨';
    els.emptyMsg.classList.toggle('hidden', list.length > 0);
    els.tabbar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
    scrollToToday('auto');
  }

  // Drop an event from the cache so it doesn't reappear when the user switches
  // tabs (tab switches re-render from cache, not the API).
  function dropFromCaches(event) {
    eventsCache = eventsCache.filter(e => !(e.id === event.id && e._calendarId === event._calendarId));
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
      dropFromCaches(event);
      setTimeout(() => UI.removeEventRow(rowEl), 220);
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
      dropFromCaches(event);
      setTimeout(() => UI.removeEventRow(rowEl), 220);
    } catch (err) {
      rowEl.classList.remove('fading');
      showError('Delete failed: ' + err.message);
    }
  }

  async function refreshCalendarList() {
    calendarsCache = await Api.listCalendars();
    calendarsById = new Map(calendarsCache.map(c => [c.id, c]));
    return calendarsCache;
  }

  async function showPickCals() {
    const settings = Store.load();
    const cals = await refreshCalendarList();
    UI.renderTabsEditor(els.pickcalsTabs, cals, settings.tabs, settings.defaultCalendarId, els.pickcalsAddTab);
    UI.renderCalendarSelect(els.doneCalSelect, cals, settings.doneCalendarId);
    UI.showOnly('view-pickcals');
  }

  // Validate + normalize the tabs editor result. Returns null (after showing an
  // error) when invalid, else { tabs, defaultCalendarId }.
  function collectTabs(container, doneCalendarId) {
    // alert() (not showError) because the inline banner lives in #view-list,
    // which is hidden during onboarding and behind the settings drawer.
    const { tabs, defaultCalendarId } = UI.readTabsEditor(container);
    if (!tabs.length || tabs.length > Store.MAX_TABS) {
      alert(`Pick 1–${Store.MAX_TABS} calendars.`);
      return null;
    }
    if (tabs.some(t => !t.calendarId)) {
      alert('Every tab needs a calendar.');
      return null;
    }
    const ids = tabs.map(t => t.calendarId);
    if (new Set(ids).size !== ids.length) {
      alert('Each calendar can only be used once.');
      return null;
    }
    if (!doneCalendarId) {
      alert('Pick a Done calendar.');
      return null;
    }
    const named = tabs.map(t => ({
      calendarId: t.calendarId,
      name: t.name || (calendarsById.get(t.calendarId)?.summary) || t.calendarId,
    }));
    return { tabs: named, defaultCalendarId: ids.includes(defaultCalendarId) ? defaultCalendarId : ids[0] };
  }

  async function openSettings() {
    const settings = Store.load();
    els.settingsClientId.value = settings.clientId;
    if (Auth.isSignedIn()) {
      const email = Auth.getEmail();
      els.accountInfo.textContent = email ? `Signed in as ${email}` : 'Signed in.';
    } else {
      els.accountInfo.textContent = 'Not signed in.';
    }
    els.signoutBtn.classList.toggle('hidden', !Auth.isSignedIn());

    if (Auth.isSignedIn()) {
      try {
        const cals = await refreshCalendarList();
        UI.renderTabsEditor(els.settingsTabs, cals, settings.tabs, settings.defaultCalendarId, els.settingsAddTab);
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
      if (!settings.tabs.length || !settings.doneCalendarId) {
        await showPickCals();
      } else {
        await loadAndRender();
      }
    } catch (err) {
      showError('Sign-in failed: ' + err.message);
    }
  });

  els.pickcalsSave.addEventListener('click', async () => {
    const doneCalendarId = els.doneCalSelect.value;
    const result = collectTabs(els.pickcalsTabs, doneCalendarId);
    if (!result) return;
    Store.patch({ tabs: result.tabs, defaultCalendarId: result.defaultCalendarId, doneCalendarId });
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
    const doneCalendarId = els.settingsDoneSelect.value;
    const result = collectTabs(els.settingsTabs, doneCalendarId);
    if (!result) return;
    Store.patch({ tabs: result.tabs, defaultCalendarId: result.defaultCalendarId, doneCalendarId });
    closeSettings();
    await loadAndRender();
  });

  els.tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const next = btn.dataset.tab;
    if (next === currentTab) return;
    currentTab = next;
    renderCurrentTab();
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
    els.tabbar.classList.add('hidden');
    document.body.classList.remove('has-tabbar');
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

    if (!settings.tabs.length || !settings.doneCalendarId) {
      await showPickCals();
      return;
    }
    await loadAndRender();
  }

  boot();
})();