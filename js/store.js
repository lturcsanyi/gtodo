// Tiny localStorage-backed settings store.
// Exposed globally as `Store` (no modules, no bundler).
(function () {
  const KEY = 'gtodo.settings.v1';

  const defaults = {
    clientId: '',
    sourceCalendarIds: [],   // ids of calendars to read events from
    doneCalendarId: '',      // id of calendar that "Complete" moves to
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
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

  window.Store = { load, save, patch };
})();