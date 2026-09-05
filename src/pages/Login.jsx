import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { signInWithPortalId, signInWithEmail, getUserProfile, dashboardPathForRole } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  AlertCircle,
  Info,
  ChevronDown,
  Loader2,
  UserRound,
  Mail,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

// ============================================
// PORTAL LOGIN (DEVELOPMENT / DEMO VERSION)
// ============================================
// One authentication flow with role-aware sign-in. The user picks a portal
// (Student / Teacher / Admin), enters their institutional ID, and the
// EXPRESS BACKEND (/api/auth/demo-login) verifies that the ID belongs to
// that role and issues a real Supabase session.
//
// ⚠️ This ID-only login is intentionally FOR DEVELOPMENT/DEMO ONLY. It is
//    NOT production-secure. Before deploying to production, replace it with
//    password / PIN / institutional SSO authentication (the architecture
//    is ready: swap the sign-in call below for signInWithPassword or SSO —
//    ProtectedRoute, dashboards, and every API keep working unchanged).
//    See also server/routes/auth.js and DISABLE_DEMO_LOGIN in .env.

const PORTALS = [
  {
    id: 'student',
    title: 'Student',
    description: 'Attendance, marks, timetable & notices',
    icon: GraduationCap,
    idLabel: 'Student ID',
    idPlaceholder: 'e.g. STU001',
  },
  {
    id: 'teacher',
    title: 'Teacher',
    description: 'Classes, students, attendance & marks',
    icon: Users,
    idLabel: 'Teacher ID',
    idPlaceholder: 'e.g. TCH001',
  },
  {
    id: 'admin',
    title: 'Admin',
    description: 'News, AI agent & system management',
    icon: ShieldCheck,
    idLabel: 'Admin ID',
    idPlaceholder: 'e.g. ADMIN001',
  },
];

// Friendly, human-readable error message per HTTP status. Backend messages
// are already user-friendly; these act as a safety net (never expose
// database internals to the user).
function friendlyAuthError(status, message) {
  if (status === 404 || status === 403 || status === 400) {
    return message || 'Invalid ID or portal. Please check and try again.';
  }
  if (status === 429) {
    return message || 'Too many sign-in attempts. Please wait a minute and try again.';
  }
  return 'Unable to sign in right now. Please try again in a moment.';
}

export default function PortalLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [portal, setPortal] = useState('');
  const [portalId, setPortalId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoIds, setShowDemoIds] = useState(false);
  const [mode, setMode] = useState(import.meta.env.PROD ? 'email' : 'portal'); // 'portal' | 'email'
  // Production uses real email/password (Supabase GoTrue). The ID-only portal
  // login is development-only (server fails it closed in production), so hide
  // it and the demo banner entirely when built for production.
  const IS_PROD = import.meta.env.PROD;

  // Legacy email/password fields (kept so the old flow still works).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If an auth session already exists, go straight to the right dashboard.
  // Redirect only once the role is KNOWN (profile loaded): while the profile
  // is still being fetched we keep rendering the form instead of guessing a
  // role — the previous `role || 'student'` guess could send non-students to
  // the wrong dashboard in the window right after sign-in.
  if (!authLoading && user && profile) {
    const fromPath = location.state?.from?.pathname;
    const fromIsProtected = fromPath && !['/login', '/signup', '/unauthorized'].includes(fromPath);
    const target = fromIsProtected ? fromPath : dashboardPathForRole(profile.role);
    return <Navigate to={target} replace />;
  }

  const activePortal = PORTALS.find((p) => p.id === portal) || null;

  const handlePortalLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!portal) {
      setError('Please choose a portal first: Student, Teacher or Admin.');
      return;
    }
    if (!portalId.trim()) {
      setError(`Please enter your ${portal} ID to continue.`);
      return;
    }

    setLoading(true);
    try {
      const { profile } = await signInWithPortalId(portalId.trim(), portal);
      navigate(dashboardPathForRole(profile.role), { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err.status, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user: authUser } = await signInWithEmail(email, password);
      // Route to the role's own dashboard (same contract as the portal-ID
      // login). The old `navigate('/')` raced with the session-aware redirect
      // above and dropped successfully signed-in users on the home page.
      const profile = await getUserProfile(authUser.id);
      navigate(dashboardPathForRole(profile.role), { replace: true });
    } catch (err) {
      // The legacy flow keeps its own (already friendly) message convention.
      if (String(err.message || '').includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (String(err.message || '').includes('Email not confirmed')) {
        setError('Please confirm your email address before logging in.');
      } else {
        setError('Unable to log in. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-6 py-16 bg-bg-soft min-h-[80vh] fade-in">
      <div className="max-w-2xl mx-auto">
        {/* Demo-mode banner — development only. Hidden in production builds. */}
        {!IS_PROD && (
          <div className="flex items-center gap-2 justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/15 text-warning-dark text-xs font-bold uppercase tracking-wide">
              <AlertCircle size={14} /> Development Demo Portal — ID-only sign in
            </span>
          </div>
        )}

        <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-text-main">MBSCET Student / Faculty Portal</h1>
            <p className="text-text-muted text-sm mt-2">
              Sign in to your academic portal. Choose your role and enter your institute ID.
            </p>
          </div>

          {mode === 'portal' && !IS_PROD ? (
            <>
              {/* Role picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Choose a portal">
                {PORTALS.map((p) => {
                  const Icon = p.icon;
                  const selected = portal === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setPortal(selected ? '' : p.id);
                        setPortalId('');
                        setError('');
                      }}
                      className={`rounded-soft-lg p-4 text-left border-2 transition ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-text-muted/20 bg-bg-soft hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${selected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                        <Icon size={20} />
                      </div>
                      <p className={`font-bold text-sm ${selected ? 'text-primary' : 'text-text-main'}`}>{p.title}</p>
                      <p className="text-xs text-text-muted mt-1 leading-snug">{p.description}</p>
                    </button>
                  );
                })}
              </div>
{/* ID input + submit */}
              <form onSubmit={handlePortalLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="portal-id" className="text-sm text-text-muted block mb-1">
                    {activePortal ? activePortal.idLabel : 'Institute ID'}
                  </label>
                  <div className="relative">
                    <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="portal-id"
                      type="text"
                      required
                      autoComplete="off"
                      value={portalId}
                      onChange={(e) => {
                        setPortalId(e.target.value.toUpperCase());
                        setError('');
                      }}
                      disabled={!portal}
                      placeholder={activePortal ? activePortal.idPlaceholder : 'Choose a portal above first'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition disabled:opacity-50 uppercase placeholder:normal-case"
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {activePortal
                      ? `Enter your ${activePortal.idLabel} exactly as printed on your institute ID card.`
                      : 'Select Student, Teacher or Admin to continue.'}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="bg-error/10 border border-error/20 rounded-soft p-3 flex gap-2">
                    <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                    <p className="text-error text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !portal}
                  className="btn-primary px-6 py-3 rounded-soft shadow-soft w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in to {activePortal?.title || 'Portal'} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {/* Demo credentials hint (development helper — not the auth mechanism) */}
              <div className="mt-6 rounded-soft bg-bg-soft border border-text-muted/20">
                <button
                  type="button"
                  onClick={() => setShowDemoIds((s) => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-muted"
                  aria-expanded={showDemoIds}
                >
                  <span className="flex items-center gap-1.5">
                    <Info size={15} className="text-primary" /> Demo accounts for this development portal
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${showDemoIds ? 'rotate-180' : ''}`} />
                </button>
                {showDemoIds && (
                  <div className="px-4 pb-4 grid sm:grid-cols-3 gap-2 text-sm">
                    <div className="rounded-soft bg-surface p-3">
                      <p className="font-bold text-text-main">STU001</p>
                      <p className="text-xs text-text-muted">Student · Demo Student</p>
                    </div>
                    <div className="rounded-soft bg-surface p-3">
                      <p className="font-bold text-text-main">TCH001</p>
                      <p className="text-xs text-text-muted">Teacher · Demo Teacher</p>
                    </div>
                    <div className="rounded-soft bg-surface p-3">
                      <p className="font-bold text-text-main">ADMIN001</p>
                      <p className="text-xs text-text-muted">Admin · Demo Administrator</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMode('email');
                    setError('');
                  }}
                  className="text-text-muted hover:text-primary transition inline-flex items-center gap-1.5"
                >
                  <Mail size={14} /> Have an email account? Sign in with email &amp; password
                </button>
              </div>
            </>
          ) : (
<>
              {/* Legacy email/password sign-in (preserved) */}
              <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
                <div>
                  <label htmlFor="login-email" className="text-sm text-text-muted block mb-1">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="text-sm text-text-muted block mb-1">Password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full pl-10 pr-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                    />
                  </div>
                </div>

                {error && (
                  <div role="alert" className="bg-error/10 border border-error/20 rounded-soft p-3">
                    <p className="text-error text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary px-6 py-3 rounded-soft shadow-soft w-full"
                >
                  {loading ? 'Logging in…' : 'Log In'}
                </button>
              </form>

              {!IS_PROD && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('portal');
                      setError('');
                    }}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    ← Back to Portal ID sign in
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-sm text-text-muted mt-6 text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}