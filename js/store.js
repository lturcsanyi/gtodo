// Tiny localStorage-backed settings store.
// Exposed globally as `Store` (no modules, no bundler).
(function () {
  const KEY = 'gtodo.settings.v1';

  const defaults = {
    clientId: '',
    tabs: [],                // ordered [{ calendarId, name }], one tab per calendar (1..5)
    defaultCalendarId: '',   // calendarId of the tab shown on load; must be one of `tabs`
    doneCalendarId: '',      // id of calendar that "Complete" moves to
  };

  const MAX_TABS = 5;

  // One-time upgrade from the old source/important model. Calendar titles aren't
  // available here, so tab names are left blank; app.js fills them from the
  // calendar list and persists, after which this no longer triggers (tabs set).
  function migrate(parsed) {
    if (Array.isArray(parsed.tabs) && parsed.tabs.length) return;
    const source = Array.isArray(parsed.sourceCalendarIds) ? parsed.sourceCalendarIds : [];
    if (!source.length) return;
    const important = parsed.importantCalendarId || '';
    const ordered = important
      ? [important, ...source.filter(id => id !== important)]
      : source.slice();
    parsed.tabs = ordered.slice(0, MAX_TABS).map(id => ({ calendarId: id, name: '' }));
    parsed.defaultCalendarId = important || ordered[0] || '';
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      migrate(parsed);
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  }

  function save(settings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }

  function patch(updates) {
    const next = { ...load(), ...updates };
    save(next);
    return next;
  }

  window.Store = { load, save, patch, MAX_TABS };
})();