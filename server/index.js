import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import academicsRouter from './routes/academics.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import recordsRouter from './routes/records.js';
import studentsRouter from './routes/students.js';
import teachersRouter from './routes/teachers.js';
import newsRouter from './routes/news.js';
import agentRouter from './routes/agent.js';
import notificationsRouter from './routes/notifications.js';
import assistantRouter from './routes/assistant.js';
import usersRouter from './routes/users.js';
import { sendError } from './lib/httpError.js';
import { startNewsScheduler } from './lib/scheduler.js';

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

// Get the actual directory of this file.
// This makes the .env path work regardless of
// which folder you run the npm command from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your .env is in the ROOT college-website folder.
// server/index.js is inside the server folder.
const envPath = path.resolve(__dirname, '../.env');

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn(`⚠️ Could not load .env from: ${envPath}`);
  console.warn('Make sure the .env file exists in the college-website root folder.');
}

// ============================================
// VALIDATE ENVIRONMENT VARIABLES
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;

// Support both the newer secret-key variable
// and the older service-role variable.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is missing.');
  console.error(`Expected .env file at: ${envPath}`);
  console.error('Add this to your .env file:');
  console.error('SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Supabase server secret key is missing.');
  console.error(`Expected .env file at: ${envPath}`);
  console.error(
    'Add SUPABASE_SERVICE_ROLE_KEY=sb_secret_... to your .env file.'
  );
  process.exit(1);
}

// ============================================
// INITIALIZE APP
// ============================================

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Render's reverse proxy every connection arrives from the proxy IP
// unless we trust the first X-Forwarded-For hop. This makes req.ip resolve to
// the real client IP, which the auth rate limiter (server/routes/auth.js) uses
// for per-IP attempt buckets. Single-hop proxy => trust proxy: 1 is safe.
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CORS: explicit allow-list (Phase 1 hardening — previously app.use(cors())
// allowed every origin). Browser clients are the Vercel frontend (production
// + preview deployments) and, in development, the Vite dev server on localhost.
// Requests without an Origin header (curl, Render health checks, the Vercel
// /api proxy) are same-origin/server-to-server and are allowed through.
const corsOriginEnv = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://college-website-dev-11.vercel.app',
  ...corsOriginEnv,
]);

// Vercel preview deployments use deterministic project subdomains.
const vercelPreviewRe = /^https:\/\/college-website(-[a-z0-9]+)*\.vercel\.app$/i;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || vercelPreviewRe.test(origin)) {
      return callback(null, true);
    }
    console.warn(`[cors] blocked origin: ${origin}`);
    return callback(null, false); // no CORS headers → browser blocks the response
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
app.use(cors(corsOptions));
app.use(express.json());

// Request logger — records only failed requests (4xx/5xx) so problems stay
// diagnosable without flooding the console with routine traffic.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      console.warn(
        `[http] ${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode}`
      );
    }
  });
  next();
});

// ============================================
// MODULAR API ROUTERS — Phase 3 + Phase 4
// The news router is mounted FIRST because its public
// feed/source-listing endpoints must stay reachable without
// authentication; all later routers apply a global
// authRequired guard at mount time. The news router guards
// its own /admin and write endpoints internally.
// Mounted before the legacy inline handlers below so the
// authenticated, service-role API takes precedence for
// attendance, marks, timetable, student/teacher dashboards,
// profile, and academic reference data (and closes the
// unauthenticated legacy /verify and /pending-review holes).
// ============================================
app.use('/api/news', newsRouter);
app.use('/api/auth', authRouter);
app.use('/api', academicsRouter);
app.use('/api/profile', profileRouter);
app.use('/api', recordsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/agent', agentRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/users', usersRouter);
console.log('✅ Modular API routers mounted (news, auth, agent, academics, profile, records, students, teachers, notifications, assistant, users)');

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'College Digital Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// SECURITY HARDENING (Phase 1): the ~890 lines of legacy inline
// REST handlers that used to live in this region were removed.
// Several were reachable WITHOUT authentication (PUT /api/news/:id/verify,
// GET /api/notifications/:userId, GET|PUT /api/notifications/preferences/:userId,
// GET /api/timetable) and the rest duplicated the authorized routers in
// ./routes/*. The frontend consumes only the modular routes (verified).
// Do not re-add unauthenticated data endpoints.
// -------------------------------------------------------------


// ============================================
// ERROR HANDLING
// ============================================

// Central error strategy (Phase 6): every route delegates unexpected errors
// to sendError (server/lib/httpError.js) which returns the standardized
// { error, code } envelope and NEVER leaks raw internal/database messages.
// This global handler is the safety net for anything that calls next(error):
// middleware, body-parser JSON syntax errors, and uncaught async throws.

// 404 handler (registered after routes)
app.use(
  (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
    });
  }
);

// Global Express error handler (must stay last)
app.use(
  (err, req, res, _next) => {
    // body-parser JSON syntax errors arrive with status 400 and type
    // 'entity.parse.failed' — map them to the standard envelope instead of 500.
    if (err && err.type === 'entity.parse.failed') {
      console.warn(`[http-error] 400 ${req.method} ${req.originalUrl} (malformed JSON)`);
      return res.status(400).json({
        error: 'Request body is not valid JSON',
        code: 'MALFORMED_JSON',
      });
    }

    sendError(res, err);
  }
);

// ============================================
// START SERVER
// ============================================

// Best-effort LAN IPv4 (for helpful startup logs only — nothing binds to it).
function getLanIpAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const net of addresses || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

// Bind explicitly to 0.0.0.0 so the API is reachable from other devices on
// the same Wi-Fi (e.g. direct health checks from a phone, or via the Vite
// dev proxy which forwards /api to localhost:3001 on this PC).
app.listen(
  PORT,
  '0.0.0.0',
  () => {
    const lanIp = getLanIpAddress();
    console.log('');
    console.log(
      '🚀 College Digital Platform API running'
    );
    console.log(
      `📡 Health check: http://localhost:${PORT}/health`
    );
    if (lanIp) {
      console.log(
        `📱 Same-network devices: http://${lanIp}:${PORT}/health`
      );
    }
    console.log(
      `🔗 API Base URL: http://localhost:${PORT}/api`
    );
    console.log(
      `🔐 Supabase: Connected`
    );
    startNewsScheduler();
    console.log('');
  }
);
