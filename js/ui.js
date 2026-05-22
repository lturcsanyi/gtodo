// Rendering helpers. Exposes `UI` globally.
(function () {
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function dayKey(d) {
    return startOfDay(d).toISOString().slice(0, 10);
  }

  function dayLabel(d) {
    const today = startOfDay(new Date());
    const that = startOfDay(d);
    const diffDays = Math.round((that - today) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays < 7) return that.toLocaleDateString(undefined, { weekday: 'long' });
    return that.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function eventStartDate(e) {
    return new Date(e.start.dateTime || e.start.date);
  }

  function eventIsAllDay(e) {
    return !!e.start.date && !e.start.dateTime;
  }

  function timeLabel(e) {
    if (eventIsAllDay(e)) return '——';
    const d = eventStartDate(e);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Group events into ordered { dayKey, label, items[] }.
  function groupByDay(events) {
    const groups = new Map();
    for (const e of events) {
      const d = eventStartDate(e);
      const key = dayKey(d);
      if (!groups.has(key)) {
        groups.set(key, { dayKey: key, label: dayLabel(d), date: startOfDay(d), items: [] });
      }
      groups.get(key).items.push(e);
    }
    return Array.from(groups.values()).sort((a, b) => a.date - b.date);
  }

  function renderEventList(container, events, handlers) {
    container.innerHTML = '';
    const groups = groupByDay(events);
    for (const g of groups) {
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = g.label;
      container.appendChild(header);

      for (const e of g.items) {
        const row = document.createElement('div');
        row.className = 'event-row';
        row.dataset.eventId = e.id;

        const check = document.createElement('button');
        check.className = 'event-check';
        check.title = 'Complete (move to Done)';
        check.setAttribute('aria-label', 'Complete');
        check.addEventListener('click', (ev) => {
          ev.stopPropagation();
          handlers.onComplete(e, row);
        });
        row.appendChild(check);

        const time = document.createElement('span');
        time.className = 'event-time';
        time.textContent = timeLabel(e);
        row.appendChild(time);

        const title = document.createElement('span');
        title.className = 'event-title';
        title.textContent = e.summary || '(no title)';
        row.appendChild(title);

        const del = document.createElement('button');
        del.className = 'event-delete';
        del.innerHTML = '×';
        del.title = 'Delete';
        del.setAttribute('aria-label', 'Delete');
        del.addEventListener('click', (ev) => {
          ev.stopPropagation();
          handlers.onDelete(e, row);
        });
        row.appendChild(del);

        // Tap on the row body (title/time area) opens the event in Calendar.
        row.addEventListener('click', () => {
          if (e.htmlLink) window.open(e.htmlLink, '_blank', 'noopener');
        });

        container.appendChild(row);
      }
    }
  }

  function renderCalendarChecklist(container, calendars, selectedIds, opts = {}) {
    container.innerHTML = '';
    const excludeId = opts.excludeId;
    for (const cal of calendars) {
      if (excludeId && cal.id === excludeId) continue;
      const row = document.createElement('label');
      row.className = 'cal-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = cal.id;
      cb.checked = selectedIds.includes(cal.id);
      row.appendChild(cb);

      const swatch = document.createElement('span');
      swatch.className = 'cal-swatch';
      swatch.style.background = cal.colorBackground;
      row.appendChild(swatch);

      const label = document.createElement('span');
      label.className = 'cal-label';
      label.textContent = cal.summary + (cal.primary ? ' (primary)' : '');
      row.appendChild(label);

      container.appendChild(row);
    }
  }

  function getCheckedIds(container) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  }

  function renderCalendarSelect(select, calendars, selectedId) {
    select.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select —';
    select.appendChild(blank);
    for (const cal of calendars) {
      const opt = document.createElement('option');
      opt.value = cal.id;
      opt.textContent = cal.summary + (cal.primary ? ' (primary)' : '');
      if (cal.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function showOnly(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== viewId));
  }

  window.UI = {
    renderEventList,
    renderCalendarChecklist,
    getCheckedIds,
    renderCalendarSelect,
    showOnly,
  };
})();