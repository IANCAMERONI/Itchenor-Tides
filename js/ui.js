/**
 * Wires tide data + the clock tick to the DOM. Kept deliberately dumb —
 * all the actual maths lives in TideMath, all the drawing in SeaWindow
 * and TideCurve.
 */
function createUI({ sea, curve }) {
  const el = {
    clockDate: document.getElementById('clock-date'),
    statusPill: document.getElementById('status-pill'),
    statusText: document.getElementById('status-text'),
    currentHeight: document.getElementById('current-height'),
    trendWrap: document.getElementById('current-trend'),
    trendArrow: document.getElementById('trend-arrow'),
    trendText: document.getElementById('trend-text'),
    trendRate: document.getElementById('trend-rate'),
    highTideSlots: [
      { time: document.getElementById('event-1a-time'), height: document.getElementById('event-1a-height') },
      { time: document.getElementById('event-1b-time'), height: document.getElementById('event-1b-height') },
    ],
    lowTideSlots: [
      { time: document.getElementById('event-2a-time'), height: document.getElementById('event-2a-height') },
      { time: document.getElementById('event-2b-time'), height: document.getElementById('event-2b-height') },
    ],
    event1Day: document.getElementById('event-1-day'),
    event2Day: document.getElementById('event-2-day'),
    footerMoon: document.getElementById('footer-moon'),
    footerFullMoon: document.getElementById('footer-full-moon'),
    footerUpdated: document.getElementById('footer-updated'),
    footerPosition: document.getElementById('footer-position'),
  };

  const STATUS_COPY = {
    loading: 'Acquiring tidal data…',
    live: 'Live · WorldTides · Chart Datum',
    stale: 'Signal Lost · Showing Last Known Data',
    error: 'No Data Link',
    preview: 'Preview · Sample Data, Not Live',
  };

  el.footerPosition.textContent = CONFIG.location.positionLabel;

  function renderClock(now) {
    // Shows whichever day the curve slider is currently viewing, not
    // always "now" - a live ticking clock had little point once the rest
    // of the display (curve, high/low cards) can be showing a future
    // day; the moon phase/full-moon countdown stay tied to the real date
    // though, since they're both about the actual sky tonight, not a
    // hypothetical future one.
    const offset = curve.getDayOffset();
    const dateShown = offset === 0 ? now : new Date(TideMath.startOfDayOffset(offset));
    el.clockDate.textContent = dateShown.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    el.footerMoon.textContent = TideMath.moonPhase(now);
    el.footerFullMoon.textContent = TideMath.formatDaysUntilFullMoon(TideMath.daysUntilFullMoon(now));
  }

  function renderStatus(snapshot) {
    el.statusPill.dataset.state = snapshot.status;
    el.statusText.textContent = STATUS_COPY[snapshot.status] || STATUS_COPY.error;

    if (snapshot.fetchedAt) {
      const d = new Date(snapshot.fetchedAt);
      el.footerUpdated.textContent = TideMath.formatClockTime(d);
    } else {
      el.footerUpdated.textContent = '—';
    }
  }

  function renderLevel(snapshot, now) {
    const nowMs = now.getTime();
    if (!snapshot.heights.length) {
      el.currentHeight.textContent = '–.–';
      el.trendText.textContent = 'No data';
      el.trendRate.textContent = '';
      return;
    }
    const height = TideMath.heightAt(snapshot.heights, nowMs);
    const trend = TideMath.trendAt(snapshot.heights, nowMs);

    el.currentHeight.textContent = height != null ? height.toFixed(2) : '–.–';
    el.trendWrap.dataset.dir = trend.direction;

    if (trend.direction === 'rising') {
      el.trendArrow.textContent = '↗';
      el.trendText.textContent = 'Rising';
      el.trendRate.textContent = `${Math.abs(trend.ratePerHour).toFixed(2)} m per hour`;
    } else if (trend.direction === 'falling') {
      el.trendArrow.textContent = '↘';
      el.trendText.textContent = 'Falling';
      el.trendRate.textContent = `${Math.abs(trend.ratePerHour).toFixed(2)} m per hour`;
    } else {
      el.trendArrow.textContent = '→';
      el.trendText.textContent = 'Slack water';
      el.trendRate.textContent = '';
    }
  }

  function _fillSlots(slots, events) {
    slots.forEach((slot, i) => {
      const ev = events[i];
      if (!ev) {
        slot.time.textContent = '--:--';
        slot.height.textContent = '–.–';
        return;
      }
      slot.time.textContent = TideMath.formatEventTime(new Date(ev.dt * 1000));
      slot.height.textContent = ev.height.toFixed(2);
    });
  }

  function renderEvents(snapshot) {
    // Follows the curve's day slider rather than always showing today -
    // otherwise these cards silently kept showing today's real highs/lows
    // (mislabelled "Today") no matter which future day the curve below
    // had scrubbed to. Day 0 still reads from the dense near-term
    // extremes; any day the slider can reach beyond that only exists in
    // the extended (extremes-only) dataset, same source the curve itself
    // already draws its on-curve markers from for that day.
    const offset = curve.getDayOffset();
    const dayStart = TideMath.startOfDayOffset(offset);
    const source = offset === 0 ? snapshot.extremes : snapshot.extendedExtremes;
    const highs = TideMath.eventsForDay(source, dayStart, 'High');
    const lows = TideMath.eventsForDay(source, dayStart, 'Low');

    _fillSlots(el.highTideSlots, highs);
    _fillSlots(el.lowTideSlots, lows);

    const dayLabel = TideMath.formatDayOffsetShort(offset);
    el.event1Day.textContent = dayLabel;
    el.event2Day.textContent = dayLabel;
  }

  function render(now) {
    const snapshot = TideService.getSnapshot();
    renderClock(now);
    renderStatus(snapshot);
    renderLevel(snapshot, now);
    renderEvents(snapshot);
    sea.update(snapshot);
    curve.update(snapshot);
  }

  return { render };
}
