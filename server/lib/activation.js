// ============================================================
// ACTIVATION CODE UTILITIES (Phase 1)
// ------------------------------------------------------------
// One-time activation codes for pending institutional accounts.
// Codes are generated from a high-entropy, unambiguous alphabet
// (no I/L/O/0/1) so they can be read out or typed from paper.
// Only a SHA-256 hash of the NORMALIZED code is ever stored or
// compared (timing-safe). Codes are single-use and expiring; the
// lifecycle lives in the account_activations table.
// ============================================================

import crypto from 'node:crypto';

export const ACTIVATION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACTIVATION_CODE_LENGTH = 16;
export const ACTIVATION_CODE_TTL_HOURS = 24 * 7; // one week

/** Human-friendly display grouping: XXXX-XXXX-XXXX-XXXX */
export function formatActivationCode(code) {
  return String(code).replace(/(.{4})(?=.)/g, '$1-');
}

/** Generate a fresh high-entropy activation code (already normalized). */
export function generateActivationCode() {
  const bytes = crypto.randomBytes(ACTIVATION_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ACTIVATION_CODE_LENGTH; i += 1) {
    code += ACTIVATION_CODE_ALPHABET[bytes[i] % ACTIVATION_CODE_ALPHABET.length];
  }
  return code;
}

/** Normalize user input: uppercase, strip everything non-alphanumeric. */
export function normalizeActivationCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** SHA-256 hex of the normalized code — the only stored form. */
export function hashActivationCode(normalizedCode) {
  return crypto.createHash('sha256').update(normalizedCode, 'utf8').digest('hex');
}

/** Timing-safe comparison of a normalized provided code vs stored hash. */
export function codeMatches(normalizedCode, storedHashHex) {
  const provided = crypto.createHash('sha256').update(normalizedCode, 'utf8').digest();
  const stored = Buffer.from(storedHashHex, 'hex');
  return provided.length === stored.length && crypto.timingSafeEqual(provided, stored);
}

/** Institutional IDs are uppercase by convention; normalize at boundaries. */
export function normalizeInstitutionalId(value) {
  return String(value || '').trim().toUpperCase();
}