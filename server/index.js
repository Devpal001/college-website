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

// ============================================
// MIDDLEWARE
// ============================================

// CORS: permissive in this dev setup on purpose.
// 1) The Vite dev proxy makes browser requests same-origin, so CORS
//    doesn't even apply for the normal dev flow.
// 2) Direct access to :3001 (e.g. opening http://<PC-LAN-IP>:3001/health
//    from a phone for testing) must not be blocked by origin checks.
// This is safe: the Supabase service-role key never leaves this process,
// and every protected router enforces authRequired on its own routes.
app.use(cors());
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
console.log('✅ Modular API routers mounted (news, auth, agent, academics, profile, records, students, teachers, notifications, assistant)');

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

// Global Express error handler
app.use(
  (err, req, res, _next) => {
    console.error(
      'Unhandled server error:',
      err
    );

    res.status(500).json({
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong'
    });
  }
);

// 404 handler
app.use(
  (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl
    });
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
