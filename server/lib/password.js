// ============================================================
// PASSWORD POLICY (shared, Phase 1)
// ------------------------------------------------------------
// Single source of truth for the password policy used by BOTH
// account provisioning (POST /api/users/admin) and self-service
// account activation (POST /api/auth/activate). Aligned with
// Supabase/GoTrue's 72-byte password cap.
// ============================================================

import { HttpError } from './httpError.js';
import crypto from 'node:crypto';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // Supabase/GoTrue caps at 72 bytes

/**
 * Random password for pre-created auth users (registry accounts). Nobody
 * ever sees it — the account is unusable until the person activates with
 * their one-time code and sets a policy-compliant password of their own.
 */
export function generateRandomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

export function assertPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw HttpError.badRequest('Password is required', 'INVALID_PASSWORD');
  }
  if (password.length < PASSWORD_MIN) {
    throw HttpError.badRequest(
      `Password must be at least ${PASSWORD_MIN} characters`,
      'INVALID_PASSWORD'
    );
  }
  if (password.length > PASSWORD_MAX) {
    throw HttpError.badRequest(
      `Password must be at most ${PASSWORD_MAX} characters`,
      'INVALID_PASSWORD'
    );
  }
  if (!/[a-z]/.test(password)) {
    throw HttpError.badRequest('Password must contain a lowercase letter', 'INVALID_PASSWORD');
  }
  if (!/[A-Z]/.test(password)) {
    throw HttpError.badRequest('Password must contain an uppercase letter', 'INVALID_PASSWORD');
  }
  if (!/[0-9]/.test(password)) {
    throw HttpError.badRequest('Password must contain a digit', 'INVALID_PASSWORD');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw HttpError.badRequest(
      'Password must contain a symbol (non-alphanumeric character)',
      'INVALID_PASSWORD'
    );
  }
}