/**
 * Wires tide data + the clock tick to the DOM. Kept deliberately dumb —
 * all the actual maths lives in TideMath, all the drawing in SeaWindow
 * and TideCurve.
 */
function createUI({ sea, curve }) {
  const el = {
    clockTime: document.getElementById('clock-time'),
    clockDate: document.getElementById('clock-date'),
    statusPill: document.getElementById('status-pill'),
    statusText: document.getElementById('status-text'),
    currentHeight: document.getElementById('current-height'),
    trendWrap: document.getElementById('current-trend'),
    trendArrow: document.getElementById('trend-arrow'),
    trendText: document.getElementById('trend-text'),
    trendRate: document.getElementById('trend-rate'),
    highCountdown: document.getElementById('high-countdown'),
    lowCountdown: document.getElementById('low-countdown'),
    highTide: {
      time: document.getElementById('event-1-time'),
      height: document.getElementById('event-1-height'),
    },
    lowTide: {
      time: document.getElementById('event-2-time'),
      height: document.getElementById('event-2-height'),
    },
    footerMoon: document.getElementById('footer-moon'),
    footerUpdated: document.getElementById('footer-updated'),
    footerPosition: document.getElementById('footer-position'),
  };

  const STATUS_COPY = {
    loading: 'Acquiring tidal data…',
    live: 'Live · WorldTides · Chart Datum',
    stale: 'Signal Lost · Showing Last Known Data',
    error: 'No Data Link',
  };

  el.footerPosition.textContent = CONFIG.location.positionLabel;

  function renderClock(now) {
    el.clockTime.textContent = TideMath.formatClockTime(now);
    el.clockDate.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    el.footerMoon.textContent = TideMath.moonPhase(now);
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
      el.trendRate.textContent = `${Math.abs(trend.ratePerHour).toFixed(2)} m/h`;
    } else if (trend.direction === 'falling') {
      el.trendArrow.textContent = '↘';
      el.trendText.textContent = 'Falling';
      el.trendRate.textContent = `${Math.abs(trend.ratePerHour).toFixed(2)} m/h`;
    } else {
      el.trendArrow.textContent = '→';
      el.trendText.textContent = 'Slack water';
      el.trendRate.textContent = '';
    }
  }

  function renderEvents(snapshot, now) {
    const nowMs = now.getTime();
    const nextHigh = TideMath.nextEventOfType(snapshot.extremes, nowMs, 'High');
    const nextLow = TideMath.nextEventOfType(snapshot.extremes, nowMs, 'Low');

    el.highCountdown.textContent = nextHigh
      ? TideMath.formatCountdown(nextHigh.dt * 1000, nowMs).replace(/^in /, '')
      : '–';
    el.lowCountdown.textContent = nextLow
      ? TideMath.formatCountdown(nextLow.dt * 1000, nowMs).replace(/^in /, '')
      : '–';

    [[el.highTide, nextHigh], [el.lowTide, nextLow]].forEach(([slot, ev]) => {
      if (!ev) {
        slot.time.textContent = '--:--';
        slot.height.textContent = '–.–';
        return;
      }
      slot.time.textContent = TideMath.formatEventTime(new Date(ev.dt * 1000));
      slot.height.textContent = ev.height.toFixed(2);
    });
  }

  function render(now) {
    const snapshot = TideService.getSnapshot();
    renderClock(now);
    renderStatus(snapshot);
    renderLevel(snapshot, now);
    renderEvents(snapshot, now);
    sea.update(snapshot);
    curve.update(snapshot);
  }

  return { render };
}
