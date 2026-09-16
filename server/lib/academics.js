// ============================================================
// ACADEMIC CALCULATIONS (shared domain rules)
// ------------------------------------------------------------
// Attendance and marks percentages are business rules, not formatting
// details: every module that reports them must agree on them. These helpers
// replace the copy-pasted arithmetic that lived in server/routes/students.js
// and server/routes/assistant.js.
//
// Rule encoded here: a `late` student still counts as having attended.
//
// Pure functions only — no database access — so they stay easy to reuse and
// to test on their own.
// ============================================================

/** Attendance statuses that count as having attended the class. */
export const ATTENDED_STATUSES = ['present', 'late'];

/**
 * Rounds to a fixed number of decimals without floating-point noise
 * (e.g. 78.64999 -> 78.6).
 */
export function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * `numerator` as a percentage of `denominator`.
 * Returns 0 (never NaN/Infinity) when the denominator is missing or zero.
 *
 * @param {number|string} numerator
 * @param {number|string} denominator
 * @param {{ decimals?: number }} [options]
 */
export function percentage(numerator, denominator, { decimals = 0 } = {}) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 0;
  return roundTo((top / bottom) * 100, decimals);
}

/** True when `status` counts as having attended. */
export function countsAsAttended(status) {
  return ATTENDED_STATUSES.includes(status || 'absent');
}

/**
 * Mean of per-item percentages — e.g. a student's average score across
 * assessments. Rows with a missing/zero max, or non-numeric marks, are
 * ignored, so the result is never NaN or Infinity.
 *
 * The individual terms stay unrounded until the end (only the final mean is
 * rounded), which matches how this average behaved before it was centralized.
 * Note: `null` marks coerce to 0 and therefore count as a zero score — that is
 * the pre-existing behaviour of the assistant's marks tool, kept on purpose.
 *
 * @param {Array<object>} rows
 * @param {{ obtainedKey?: string, maxKey?: string, decimals?: number }} [options]
 * @returns {{ total: number, average: number }} `total` = rows that counted.
 */
export function averageMarksPercentage(
  rows = [],
  { obtainedKey = 'marks_obtained', maxKey = 'marks_max', decimals = 0 } = {}
) {
  const terms = [];
  for (const row of rows) {
    const obtained = Number(row?.[obtainedKey]);
    const max = Number(row?.[maxKey]);
    if (!Number.isFinite(obtained) || !Number.isFinite(max) || max <= 0) continue;
    terms.push((obtained / max) * 100);
  }

  if (terms.length === 0) return { total: 0, average: 0 };

  const sum = terms.reduce((acc, term) => acc + term, 0);
  return { total: terms.length, average: roundTo(sum / terms.length, decimals) };
}

/**
 * Counts attendance rows by status and derives the dashboards' attendance
 * summary. Shape is the contract the frontend consumes: `presentCount` and
 * `percentage` (1 decimal by default, matching the student dashboard).
 *
 * @param {Array<{status?: string}>} records
 * @param {{ decimals?: number }} [options]
 */
export function summarizeAttendance(records = [], { decimals = 1 } = {}) {
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length };

  for (const record of records) {
    const status = record?.status || 'absent';
    summary[status] = (summary[status] || 0) + 1;
  }

  summary.presentCount = summary.present + summary.late;
  summary.percentage = percentage(summary.presentCount, summary.total, { decimals });
  return summary;
}