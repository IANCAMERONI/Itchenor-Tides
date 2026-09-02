/**
 * Formats decimal-degree coordinates as the degrees/minutes notation
 * mariners actually use (e.g. "50°47.9' N   000°52.1' W"), so the
 * footer's position readout can be derived from whatever location the
 * user configures rather than a hardcoded string.
 */
const GeoFormat = (() => {
  function _part(value, width, positiveLabel, negativeLabel) {
    const hemisphere = value >= 0 ? positiveLabel : negativeLabel;
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    return `${String(degrees).padStart(width, '0')}°${minutes.toFixed(1)}′ ${hemisphere}`;
  }

  /** Latitude gets a 2-digit degree field (0-90), longitude 3 (0-180). */
  function formatPosition(lat, lon) {
    return `${_part(lat, 2, 'N', 'S')}   ${_part(lon, 3, 'E', 'W')}`;
  }

  return { formatPosition };
})();
