import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { sendError, HttpError } from '../lib/httpError.js';
import { requireString, requireEmail, optionalString } from '../lib/validate.js';
import { createRateLimiter } from '../lib/rateLimit.js';

// ============================================================
// PUBLIC FORM ENDPOINTS (unauthenticated by design)
// ------------------------------------------------------------
// These are the only two write endpoints that anonymous visitors
// may reach: the admissions enquiry form and the contact form.
//
// Why they live on the server instead of "insert straight from the
// browser", which is what Admissions.jsx/Contact.jsx used to do:
//   1. Portability — the browser no longer needs direct database
//      access at all. The college can host its own PostgreSQL/API
//      later and only this module changes.
//   2. Validation — the field whitelist is enforced in one place;
//      a client cannot stuff arbitrary columns into the row.
//   3. Abuse control — one shared, parameterized rate limiter.
//   4. Error contract — the standard { error, code } envelope, and
//      no raw database message is ever returned to the visitor.
//
// The service-role client is used server-side only (never shipped
// to the browser). Table access stays deny-by-default for anon.
// ============================================================

const router = Router();

// Both forms share ONE bucket per IP: a spam script cannot get more
// submissions through by alternating between the two endpoints.
const formSubmissions = createRateLimiter({ windowMs: 60_000, max: 10 });
const rateLimitForms = formSubmissions.middleware({
  message: 'Too many submissions from this device. Please wait a minute and try again.',
});

// Accepts +91-234-5678, 8082607955, (0191) 234-5678, ...
const PHONE_RE = /^[+0-9][0-9+\-() ]{6,19}$/;

function requirePhone(value, field = 'phone') {
  const phone = requireString(value, field, { max: 20 });
  if (!PHONE_RE.test(phone)) {
    throw HttpError.badRequest(
      `${field} must be a valid contact number`,
      'INVALID_PHONE'
    );
  }
  return phone;
}

// ============================================
// POST /api/admissions
// Body: { full_name, email, phone, course_applied, message? }
// Public — the online application enquiry form.
// ============================================
router.post('/admissions', rateLimitForms, async (req, res) => {
  try {
    const body = req.body || {};

    const row = {
      full_name: requireString(body.full_name, 'full_name', { max: 120 }),
      email: requireEmail(body.email, 'email'),
      phone: requirePhone(body.phone),
      course_applied: requireString(body.course_applied, 'course_applied', { max: 120 }),
      message: optionalString(body.message, 'message', { max: 2000 }) ?? null,
    };

    const { error } = await supabase.from('admissions').insert(row);
    if (error) throw error;

    return res.status(201).json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

// ============================================
// POST /api/contact
// Body: { name, email, message }
// Public — the "Send a Message" form on /contact.
// ============================================
router.post('/contact', rateLimitForms, async (req, res) => {
  try {
    const body = req.body || {};

    const row = {
      name: requireString(body.name, 'name', { max: 120 }),
      email: requireEmail(body.email, 'email'),
      message: requireString(body.message, 'message', { max: 2000 }),
    };

    const { error } = await supabase.from('messages').insert(row);
    if (error) throw error;

    return res.status(201).json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
