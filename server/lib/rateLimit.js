// ============================================================
// REUSABLE IN-MEMORY RATE LIMITER
// ------------------------------------------------------------
// Extracted from server/routes/auth.js so every abuse-sensitive
// endpoint (authentication, public form submissions, ...) shares
// ONE parameterized implementation instead of copy-pasted blocks.
//
// Scope: a single Node process (a Map held in memory). That matches
// this deployment (one Express instance). If the API is ever scaled
// to several replicas, replace the store with Redis or the host's
// rate-limit middleware — call sites only depend on
// `createRateLimiter()`, so they do not change.
// ============================================================

const MAX_TRACKED_KEYS = 10_000;

/**
 * Creates a limiter that counts hits per key inside a sliding window.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] Sliding window length in ms.
 * @param {number} [options.max=10] Allowed hits per key inside the window.
 * @param {(req: object) => string} [options.keyFn] Key extractor (default: client IP).
 * @returns {{
 *   isLimited: (key?: string) => boolean,
 *   middleware: (opts?: { message?: string, code?: string }) => Function
 * }}
 */
export function createRateLimiter({ windowMs = 60_000, max = 10, keyFn } = {}) {
  /** @type {Map<string, number[]>} key -> timestamps inside the window */
  const hits = new Map();

  function isLimited(key = 'unknown') {
    const now = Date.now();

    // Bounded memory: drop keys with no activity left in the window.
    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [tracked, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(tracked);
      }
    }

    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      hits.set(key, recent); // keep the pruned window for the next check
      return true;
    }

    recent.push(now);
    hits.set(key, recent);
    return false;
  }

  /**
   * Express middleware wrapper. Several routes can share ONE limiter (and
   * therefore one bucket) while still returning their own message:
   *   const limiter = createRateLimiter({ max: 10 });
   *   router.post('/a', limiter.middleware({ message: '...' }), handler);
   *   router.post('/b', limiter.middleware({ message: '...' }), handler);
   */
  function middleware({
    message = 'Too many requests. Please wait and try again.',
    code = 'RATE_LIMITED',
  } = {}) {
    return function rateLimitMiddleware(req, res, next) {
      const key = keyFn ? keyFn(req) : String(req.ip || 'unknown');
      if (isLimited(key)) {
        return res.status(429).json({ error: message, code });
      }
      return next();
    };
  }

  return { isLimited, middleware };
}

export default createRateLimiter;
