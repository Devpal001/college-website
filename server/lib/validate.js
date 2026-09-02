// ============================================================
// SERVER-SIDE INPUT VALIDATION (Phase 6)
// ------------------------------------------------------------
// Every helper throws HttpError(400) with a stable machine code;
// routes catch locally and delegate to sendError(res, error), which
// maps HttpError -> { error, code } with status 400.
//
// Never trust req.body / req.params / req.query. Validate at the
// boundary of every mutation endpoint.
// ============================================================

import { HttpError } from './httpError.js';

export function badRequest(message, code = 'INVALID_REQUEST') {
  throw HttpError.badRequest(message, code);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function requireUuid(value, field) {
  if (!isUuid(value)) badRequest(`${field} must be a valid UUID`, 'INVALID_ID');
  return value;
}

export function requireString(value, field, { min = 1, max = 255, trim = true } = {}) {
  const s = typeof value === 'string' ? (trim ? value.trim() : value) : '';
  if (s.length < min || s.length > max) {
    badRequest(
      min === 1
        ? `${field} must be between 1 and ${max} characters`
        : `${field} must be between ${min} and ${max} characters`,
      'INVALID_STRING'
    );
  }
  return s;
}

export function optionalString(value, field, { max = 255, trim = true } = {}) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field, { min: 1, max, trim });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates and normalizes an email address (lowercased). */
export function requireEmail(value, field) {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) {
    badRequest(`${field} must be a valid email address`, 'INVALID_EMAIL');
  }
  return s;
}

export function requireOneOf(value, field, allowed) {
  if (!Array.isArray(allowed) || !allowed.includes(value)) {
    badRequest(`${field} must be one of: ${allowed.join(', ')}`, 'INVALID_ENUM');
  }
  return value;
}

export function requireNumber(value, field, { min, max, integer = false } = {}) {
  const n = Number(value);
  if (Number.isNaN(n) || (integer && !Number.isInteger(n))) {
    badRequest(`${field} must be a valid number`, 'INVALID_NUMBER');
  }
  if (min !== undefined && n < min) badRequest(`${field} must be at least ${min}`, 'OUT_OF_RANGE');
  if (max !== undefined && n > max) badRequest(`${field} must be at most ${max}`, 'OUT_OF_RANGE');
  return n;
}

export function requireDate(value, field) {
  const valid =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
  if (!valid) badRequest(`${field} must be a valid date (YYYY-MM-DD)`, 'INVALID_DATE');
  return value;
}

export function requireArray(value, field, { max = 1000, nonEmpty = true } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    badRequest(`${field} must be a non-empty array`, 'INVALID_ARRAY');
  }
  if (Array.isArray(value) && value.length > max) {
    badRequest(`${field} must contain at most ${max} items`, 'ARRAY_TOO_LARGE');
  }
  return value;
}

/** Parses ?limit=&page= with hard caps (abuse resistance). */
export function pagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawLimit = Number(req.query?.limit ?? defaultLimit);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const rawPage = Number(req.query?.page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  return { limit, page, offset: (page - 1) * limit };
}