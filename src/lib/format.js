// ============================================================
// SHARED DISPLAY FORMATTERS
// ------------------------------------------------------------
// Values that appear in more than one component are formatted here so the
// same data can never render two different ways. Keep these pure (no React,
// no API access) — they are the easiest things in the app to unit test.
// ============================================================

/**
 * Initials for an avatar bubble: "Devpal Singh" -> "DS".
 * Falls back to the first character, then to `fallback`.
 *
 * @param {string} name
 * @param {{ fallback?: string }} [options]
 */
export function getInitials(name, { fallback = '?' } = {}) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || fallback;
}

/**
 * Percentage as a display string with a controlled number of decimals —
 * "78.6%", or the dashboard dash when there is nothing to show.
 *
 * @param {number|string|null|undefined} value
 * @param {{ decimals?: number, fallback?: string }} [options]
 */
export function formatPercent(value, { decimals = 1, fallback = '—' } = {}) {
  // Treat "no value" as missing rather than as 0 — Number(null) is 0, which
  // would otherwise render an empty field as "0.0%".
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${numeric.toFixed(decimals)}%`;
}