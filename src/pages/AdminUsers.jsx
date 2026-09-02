import { useCallback, useEffect, useState } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import PortalLayout from '../components/PortalLayout';

const ROLES = ['student', 'teacher', 'admin', 'super_admin'];

const inputCls =
  'px-3 py-2 text-sm rounded-soft bg-surface border border-text-muted/15 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

const labelCls = 'block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1';

function roleTone(role) {
  if (role === 'super_admin') return 'red';
  if (role === 'admin') return 'amber';
  if (role === 'teacher') return 'blue';
  return 'green';
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return <div className="bg-error/10 text-error-dark rounded-soft p-3 text-sm">{message}</div>;
}

function OkNote({ message }) {
  if (!message) return null;
  return <div className="bg-success/10 text-success-dark rounded-soft p-3 text-sm">{message}</div>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filters, setFilters] = useState({ role: '', q: '' });

  const [form, setForm] = useState({
    role: 'student',
    fullName: '',
    email: '',
    password: '',
    enrollmentNumber: '',
    employeeId: '',
    semesterNumber: '',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: '25' });
        if (filters.role) params.set('role', filters.role);
        if (filters.q.trim()) params.set('q', filters.q.trim());
        const res = await api.get(`/api/users/admin?${params.toString()}`);
        setUsers(res?.data || []);
        setMeta(res?.meta || { page: 1, limit: 25, total: 0 });
      } catch (err) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const provision = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setFormError('Name, email and password are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/users/admin', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        enrollmentNumber: form.role === 'student' ? form.enrollmentNumber.trim() : undefined,
        employeeId: form.role === 'teacher' ? form.employeeId.trim() : undefined,
        semesterNumber:
          form.role === 'student' && form.semesterNumber
            ? Number(form.semesterNumber)
            : undefined,
      });
      setForm((f) => ({ ...f, fullName: '', email: '', password: '', enrollmentNumber: '', employeeId: '', semesterNumber: '' }));
      flash('Account provisioned');
      await load(1);
    } catch (err) {
      setFormError(err.message || 'Failed to provision account');
    } finally {
      setCreating(false);
    }
  };

  return (
    <PortalLayout>
      <div className="px-6 md:px-8 py-10 max-w-6xl mx-auto space-y-4">
        {/* Provision form */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-primary" />
            <h2 className="text-lg font-bold text-text-main">Provision account</h2>
          </div>
          <form onSubmit={provision} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role">
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inputCls}>
                {ROLES.filter((r) => r !== 'super_admin').map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Full name">
              <input type="text" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className={inputCls} placeholder="e.g. Aarav Sharma" />
            </Field>
            <Field label="Institutional email">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="name@mbscet.in" autoComplete="off" />
            </Field>
            <Field label="Initial password (min 10 chars, mixed case, digit, symbol)">
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} autoComplete="new-password" />
            </Field>
            {form.role === 'student' && (
              <>
                <Field label="Enrollment number">
                  <input type="text" value={form.enrollmentNumber} onChange={(e) => setForm((f) => ({ ...f, enrollmentNumber: e.target.value }))} className={inputCls} placeholder="e.g. STU2026-014" />
                </Field>
                <Field label="Semester (optional)">
                  <input type="number" min="1" max="10" value={form.semesterNumber} onChange={(e) => setForm((f) => ({ ...f, semesterNumber: e.target.value }))} className={inputCls} />
                </Field>
              </>
            )}
            {form.role === 'teacher' && (
              <Field label="Employee ID">
                <input type="text" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className={inputCls} placeholder="e.g. TCH2026-07" />
              </Field>
            )}
            <div className="sm:col-span-2">
              <ErrorNote message={formError} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium">
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        <OkNote message={notice} />
        <ErrorNote message={error} />

        {/* User list */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-text-main mr-auto">
              Users <span className="text-sm font-normal text-text-muted">({meta.total})</span>
            </h2>
            <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} className={`${inputCls} w-auto`} aria-label="Filter by role">
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input type="text" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search name or email…" className={`${inputCls} w-48`} aria-label="Search users" />
            <button onClick={() => load(meta.page)} aria-label="Refresh" className="w-9 h-9 flex items-center justify-center rounded-soft bg-primary/10 text-primary hover:bg-primary/20 transition">
              <RefreshCw size={15} />
            </button>
          </div>

          {loading && users.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-navbar shadow-soft rounded-soft p-4 animate-pulse">
                  <div className="h-4 bg-black/5 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-black/5 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-14 text-text-muted text-sm">No users match these filters.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="bg-navbar shadow-soft rounded-soft p-4 flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-main truncate">{u.full_name || '—'}</p>
                    <p className="text-xs text-text-muted truncate">{u.email}</p>
                  </div>
                  <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                  {u.students?.enrollment_number && <Badge>{u.students.enrollment_number}</Badge>}
                  {u.teachers?.employee_id && <Badge>{u.teachers.employee_id}</Badge>}
                  <Badge tone={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'active' : 'inactive'}</Badge>
                </div>
              ))}
            </div>
          )}

          {meta.total > meta.limit && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button disabled={meta.page <= 1} onClick={() => load(meta.page - 1)} className="px-4 py-2 rounded-soft bg-surface border border-text-muted/15 disabled:opacity-40">Previous</button>
              <span className="text-text-muted">Page {meta.page} of {Math.ceil(meta.total / meta.limit)}</span>
              <button disabled={meta.page >= Math.ceil(meta.total / meta.limit)} onClick={() => load(meta.page + 1)} className="px-4 py-2 rounded-soft bg-surface border border-text-muted/15 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>

      </div>
    </PortalLayout>
  );
}


