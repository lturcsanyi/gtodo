// Thin Google Calendar REST v3 wrapper.
// Exposes `Api` globally.
(function () {
  const BASE = 'https://www.googleapis.com/calendar/v3';

  async function call(path, opts = {}) {
    const token = await Auth.ensureToken();
    const url = path.startsWith('http') ? path : BASE + path;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
    });
    if (res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) {
      let msg;
      try { msg = JSON.parse(text).error.message; } catch { msg = text || res.statusText; }
      throw new Error(`${res.status}: ${msg}`);
    }
    return text ? JSON.parse(text) : null;
  }

  // List all calendars in the user's calendarList.
  async function listCalendars() {
    const data = await call('/users/me/calendarList?minAccessRole=writer&maxResults=250');
    return (data.items || []).map(c => ({
      id: c.id,
      summary: c.summary,
      colorBackground: c.backgroundColor || '#888',
      primary: !!c.primary,
      accessRole: c.accessRole,
    }));
  }

  // List events from a single calendar, between two ISO timestamps.
  async function listEventsForCalendar(calendarId, timeMin, timeMax) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    const data = await call(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    return (data.items || []).map(e => ({
      ...e,
      _calendarId: calendarId,
    }));
  }

  // Fan-out across multiple calendars; merged + sorted by start time.
  async function listEvents(calendarIds, daysAhead = 30) {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
    const results = await Promise.all(
      calendarIds.map(id => listEventsForCalendar(id, timeMin, timeMax).catch(err => {
        console.warn('Failed to load calendar', id, err);
        return [];
      }))
    );
    const all = results.flat();
    all.sort((a, b) => {
      const aTs = new Date(a.start.dateTime || a.start.date).getTime();
      const bTs = new Date(b.start.dateTime || b.start.date).getTime();
      return aTs - bTs;
    });
    return all;
  }

  // Move an event to a different calendar.
  async function moveEvent(srcCalId, eventId, destCalId) {
    const url = `/calendars/${encodeURIComponent(srcCalId)}/events/${encodeURIComponent(eventId)}/move?destination=${encodeURIComponent(destCalId)}`;
    return await call(url, { method: 'POST' });
  }

  // Delete an event.
  async function deleteEvent(calId, eventId) {
    const url = `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`;
    return await call(url, { method: 'DELETE' });
  }

  window.Api = { listCalendars, listEvents, moveEvent, deleteEvent };
})();