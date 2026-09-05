import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api';

// ============================================
// ACTIVATE YOUR COLLEGE ACCOUNT (Phase 1)
// ============================================
// Replaces public self-signup: a person can only activate an identity the
// administration has already registered. The role is NOT chosen here — it
// comes from the authoritative record (students/teachers/admin row created
// by the registry). Verification = institutional ID + institutional email
// + one-time activation code (issued out-of-band by administration).
// ============================================

const inputCls =
  'w-full pl-10 pr-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition';

function ActivateAccount() {
  const [form, setForm] = useState({
    institutionalId: '',
    email: '',
    activationCode: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/activate', {
        institutionalId: form.institutionalId,
        email: form.email,
        activationCode: form.activationCode,
        password: form.password,
      });
      setDone(res?.data || { role: 'student', fullName: '' });
    } catch (err) {
      setError(err.message || 'Activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-6 py-16 md:py-24 bg-bg-soft min-h-[80vh] flex items-start justify-center fade-in">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-soft-lg shadow-soft p-8">
          {done ? (
            <div className="text-center">
              <ShieldCheck size={40} className="text-success mx-auto mb-3" />
              <h1 className="text-xl font-bold text-text-main mb-2">Account activated</h1>
              <p className="text-sm text-text-muted mb-1">
                Welcome{done.fullName ? `, ${done.fullName}` : ''}! Your {done.role} account is now
                active.
              </p>
              <p className="text-sm text-text-muted mb-6">
                Sign in with your institutional email and the password you just created.
              </p>
              <Link
                to="/login"
                className="btn-primary inline-block px-6 py-3 rounded-soft shadow-soft text-sm font-medium"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-text-main mb-1">Activate your college account</h1>
              <p className="text-sm text-text-muted mb-6">
                Use the institutional ID, college email and one-time activation code issued by the
                administration. Your role is set from the college record — it cannot be chosen here.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label htmlFor="act-id" className="text-sm text-text-muted block mb-1">
                    Institutional ID
                  </label>
                  <div className="relative">
                    <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="act-id"
                      type="text"
                      required
                      value={form.institutionalId}
                      onChange={update('institutionalId')}
                      placeholder="e.g. MBSCET-STU-2026-00123"
                      autoComplete="off"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="act-email" className="text-sm text-text-muted block mb-1">
                    Institutional email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="act-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@mbscet.in"
                      autoComplete="email"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="act-code" className="text-sm text-text-muted block mb-1">
                    Activation code
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      id="act-code"
                      type="text"
                      required
                      value={form.activationCode}
                      onChange={update('activationCode')}
                      placeholder="e.g. A4BK-9CDE-F2GH-3JMN"
                      autoComplete="off"
                      className={`${inputCls} font-mono tracking-wider`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="act-password" className="text-sm text-text-muted block mb-1">
                    New password
                  </label>
                  <input
                    id="act-password"
                    type="password"
                    required
                    minLength={10}
                    value={form.password}
                    onChange={update('password')}
                    placeholder="Min 10 chars — mixed case, digit, symbol"
                    autoComplete="new-password"
                    className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                  />
                </div>
                <div>
                  <label htmlFor="act-confirm" className="text-sm text-text-muted block mb-1">
                    Confirm password
                  </label>
                  <input
                    id="act-confirm"
                    type="password"
                    required
                    minLength={10}
                    value={form.confirm}
                    onChange={update('confirm')}
                    autoComplete="new-password"
                    className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                  />
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
                  {loading ? 'Activating…' : 'Activate account'}
                </button>
              </form>
              <p className="text-sm text-text-muted mt-6 text-center">
                Already activated?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default ActivateAccount;