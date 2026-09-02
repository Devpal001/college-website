// ============================================================
// CENTRAL API ERROR CONTRACT (Phase 5/6)
// ------------------------------------------------------------
// Every API endpoint responds with the same error envelope:
//   { error: "safe, user-facing message", code: "STABLE_CODE" }
//
// RULE: raw internal / database error messages are NEVER sent
// to clients. 4xx errors carry a controlled, safe message and a
// stable machine code; 5xx errors carry a generic message and
// the full detail is logged server-side only.
//
// Routes keep their existing try/catch structure but delegate to
// sendError(res, err) instead of res.status(500).json({...}).
// ============================================================

export class HttpError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message = 'Invalid request', code = 'INVALID_REQUEST') {
    return new HttpError(400, message, code);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    return new HttpError(401, message, code);
  }

  static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN') {
    return new HttpError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new HttpError(404, message, code);
  }

  static conflict(message = 'Resource already exists', code = 'CONFLICT') {
    return new HttpError(409, message, code);
  }
}

/**
 * Standardized error response for any thrown error.
 * - HttpError (or any object with a .status) uses its status/code/message.
 * - Everything else is treated as an internal 500: client gets a generic
 *   message, full detail is logged server-side.
 */
export function sendError(res, err) {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const is5xx = status >= 500;
  const message =
    !is5xx && err?.message
      ? err.message
      : 'Something went wrong. Please try again.';
  const code = is5xx ? 'INTERNAL_ERROR' : err?.code || 'ERROR';

  console.error(
    `[http-error] ${status} ${res.req?.method || '-'} ${res.req?.originalUrl || '-'}`,
    err
  );

  return res.status(status).json({ error: message, code });
}