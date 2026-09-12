import { useCallback, useEffect, useState } from 'react';
import { UserPlus, RefreshCw, GraduationCap } from 'lucide-react';
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

// ============================================
// Teacher subject assignment panel
// ------------------------------------------------------------
// teacher_subjects is what drives the teacher portal (My Classes,
// Mark Attendance, Assessments, Enter Marks). Timetable assignments
// are intentionally separate (they record WHERE, not WHAT).
// Data sources reuse existing endpoints:
//   teachers : GET /api/timetable/meta/teachers  (admin-guarded)
//   sections : GET /api/sections                 (embeds semesters + courses)
//   subjects : GET /api/subjects
// ============================================
function TeacherAssignments({ flash }) {
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState(null);

  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [asgLoading, setAsgLoading] = useState(false);
  const [asgError, setAsgError] = useState(null);

  const loadRefs = useCallback(async () => {
    setRefLoading(true);
    setRefError(null);
    try {
      const [t, s, sub] = await Promise.all([
        api.get('/api/timetable/meta/teachers'),
        api.get('/api/sections'),
        api.get('/api/subjects'),
      ]);
      setTeachers(t || []);
      setSections(s || []);
      setSubjects(sub || []);
    } catch (err) {
      setRefError(err.message || 'Failed to load reference data');
    } finally {
      setRefLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const loadAssignments = useCallback(async (tid, includeInactive = true) => {
    if (!tid) {
      setAssignments([]);
      return;
    }
    setAsgLoading(true);
    setAsgError(null);
    try {
      const res = await api.get(
        `/api/users/admin/teacher-subjects?teacherId=${tid}&includeInactive=${includeInactive}`
      );
      setAssignments(res?.data || []);
    } catch (err) {
      setAsgError(err.message || 'Failed to load assignments');
    } finally {
      setAsgLoading(false);
    }
  }, []);

  useEffect(() => {
    setSubjectId('');
    setSectionId('');
    setFormError(null);
    loadAssignments(teacherId);
  }, [teacherId, loadAssignments]);

  const selectedSection = sections.find((s) => s.id === sectionId) || null;
  // Derived from the section's real semester_id FK — never a manual pick,
  // so the admin can never submit a section/semester mismatch.
  const derivedSemesterId = selectedSection?.semesters?.id || '';
  const semesterLabel = selectedSection?.semesters
    ? `${selectedSection.semesters.name}${
        selectedSection.semesters.courses ? ` · ${selectedSection.semesters.courses.name}` : ''
      }`
    : '';

  const assign = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!teacherId) return setFormError('Select a teacher first.');
    if (!subjectId) return setFormError('Select a subject.');
    if (!sectionId) return setFormError('Select a class/section.');
    if (!derivedSemesterId) return setFormError('Selected section has no semester.');
    setBusy(true);
    try {
      const res = await api.post('/api/users/admin/teacher-subjects', {
        teacherId,
        subjectId,
        semesterId: derivedSemesterId, // derived from the section's real FK
        sectionId,
      });
      flash(res?.reactivated ? 'Assignment re-activated' : 'Subject assigned');
      setSubjectId('');
      setSectionId('');
      await loadAssignments(teacherId);
    } catch (err) {
      // Backend returns precise messages (409 duplicate, 400 relationship checks).
      setFormError(err.message || 'Failed to assign subject');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (assignmentId) => {
    setFormError(null);
    setBusy(true);
    try {
      await api.delete(`/api/users/admin/teacher-subjects/${assignmentId}`);
      flash('Assignment deactivated');
      await loadAssignments(teacherId);
    } catch (err) {
      setFormError(err.message || 'Failed to deactivate assignment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface rounded-soft-lg shadow-soft p-6">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap size={18} className="text-primary" />
        <h2 className="text-lg font-bold text-text-main">Teacher subject assignments</h2>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Subject assignments drive the teacher portal (My Classes, Mark Attendance,
        Assessments, Enter Marks). Timetable lectures are managed separately in the
        Timetable Manager.
      </p>

      {refLoading ? (
        <p className="text-sm text-text-muted">Loading teachers and courses…</p>
      ) : refError ? (
        <ErrorNote message={refError} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Teacher">
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputCls}>
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.profiles?.full_name || t.employee_id}
                    {t.employee_id ? ` (${t.employee_id})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subject">
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className={inputCls}
                disabled={!teacherId}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Class / Section">
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className={inputCls}
                disabled={!teacherId}
              >
                <option value="">Select class</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
          {semesterLabel && (
            <p className="text-xs text-text-muted mt-2">Semester: {semesterLabel} (from selected class)</p>
          )}

          <div className="mt-4">
            <ErrorNote message={formError} />
            <div className="mt-3">
              <button
                type="button"
                onClick={assign}
                disabled={busy || !teacherId || !subjectId || !sectionId}
                className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium"
              >
                {busy ? 'Saving…' : 'Assign subject'}
              </button>
            </div>
          </div>
          {/* Existing assignments */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-text-main mb-2">
              Current assignments{teacherId ? '' : ' (select a teacher)'}
            </h3>
            {!teacherId ? null : asgLoading ? (
              <p className="text-sm text-text-muted">Loading assignments…</p>
            ) : asgError ? (
              <ErrorNote message={asgError} />
            ) : assignments.length === 0 ? (
              <p className="text-sm text-text-muted">No assignments for this teacher yet.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="bg-navbar shadow-soft rounded-soft p-3 flex flex-wrap items-center gap-2"
                  >
                    <span className="text-sm text-text-main font-medium mr-auto">
                      {a.subjects?.name || 'Unknown subject'} — {a.semesters?.name || '—'}
                      {a.sections?.name ? ` — ${a.sections.name}` : ''}
                    </span>
                    <Badge tone={a.is_active ? 'green' : 'gray'}>
                      {a.is_active ? 'active' : 'inactive'}
                    </Badge>
                    {a.is_active && (
                      <button
                        type="button"
                        onClick={() => deactivate(a.id)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-soft bg-error/10 text-error-dark hover:bg-error/20 disabled:opacity-50 transition"
                      >
                        Deactivate
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
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
    institutionalId: '',
    enrollmentNumber: '',
    employeeId: '',
    semesterNumber: '',
    requireActivation: false,
  });
  const [activation, setActivation] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  // One-time activation codes are displayed grouped for readability.
  const formatCode = (code) => String(code).replace(/(.{4})(?=.)/g, '$1-');

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
    setActivation(null);

    // --- Registry mode (Phase 1): create a PENDING authoritative identity.
    // The person activates with the one-time code + their own password; the
    // role comes from the registry entry, never from the person.
    if (form.requireActivation) {
      if (!form.fullName.trim() || !form.email.trim() || !form.institutionalId.trim()) {
        setFormError('Name, institutional email and institutional ID are required');
        return;
      }
      setCreating(true);
      try {
        const res = await api.post('/api/users/registry', {
          institutionalId: form.institutionalId.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          semesterNumber:
            form.role === 'student' && form.semesterNumber
              ? Number(form.semesterNumber)
              : undefined,
        });
        setActivation(res?.data || null);
        setForm((f) => ({ ...f, fullName: '', email: '', institutionalId: '', semesterNumber: '' }));
        await load(1);
      } catch (err) {
        setFormError(err.message || 'Failed to register identity');
      } finally {
        setCreating(false);
      }
      return;
    }

    // --- Direct provisioning mode (unchanged): active account with an
    //     initial password delivered out-of-band by the administrator.
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
            <label className="flex items-center gap-2 text-sm text-text-muted self-end pb-2">
              <input
                type="checkbox"
                checked={form.requireActivation}
                onChange={(e) => setForm((f) => ({ ...f, requireActivation: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              Registry activation — create as PENDING, person activates with a one-time code
            </label>
            <Field label="Full name">
              <input type="text" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className={inputCls} placeholder="e.g. Aarav Sharma" />
            </Field>
            <Field label="Institutional email">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="name@mbscet.in" autoComplete="off" />
            </Field>
            {form.requireActivation ? (
              <Field label="Institutional ID (issued by the college — becomes the login identity)">
                <input type="text" value={form.institutionalId} onChange={(e) => setForm((f) => ({ ...f, institutionalId: e.target.value }))} className={inputCls} placeholder="e.g. MBSCET-STU-2026-00123" autoComplete="off" />
              </Field>
            ) : (
              <Field label="Initial password (min 10 chars, mixed case, digit, symbol)">
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} autoComplete="new-password" />
              </Field>
            )}
            {form.role === 'student' && (
              <>
                {!form.requireActivation && (
                  <Field label="Enrollment number">
                    <input type="text" value={form.enrollmentNumber} onChange={(e) => setForm((f) => ({ ...f, enrollmentNumber: e.target.value }))} className={inputCls} placeholder="e.g. STU2026-014" />
                  </Field>
                )}
                <Field label="Semester (optional)">
                  <input type="number" min="1" max="10" value={form.semesterNumber} onChange={(e) => setForm((f) => ({ ...f, semesterNumber: e.target.value }))} className={inputCls} />
                </Field>
              </>
            )}
            {form.role === 'teacher' && !form.requireActivation && (
              <Field label="Employee ID">
                <input type="text" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className={inputCls} placeholder="e.g. TCH2026-07" />
              </Field>
            )}
            {activation && (
              <div className="sm:col-span-2 bg-warning/10 border border-warning/30 rounded-soft p-4">
                <p className="text-sm font-semibold text-warning-dark mb-1">
                  Activation code for {activation.institutional_id} — shown only once
                </p>
                <p className="font-mono text-lg tracking-widest text-text-main select-all break-all">
                  {formatCode(activation.activationCode)}
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Deliver it to the person together with their institutional ID and institutional
                  email ({activation.email}). They activate at <span className="font-medium">/activate</span>{' '}
                  with this code and a new password. Expires{' '}
                  {new Date(activation.activationExpiresAt).toLocaleString()}.
                </p>
              </div>
            )}
            <div className="sm:col-span-2">
              <ErrorNote message={formError} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium">
                {creating ? 'Creating…' : form.requireActivation ? 'Register identity' : 'Create account'}
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
                  {u.status && u.status !== 'active' && <Badge tone="amber">{u.status}</Badge>}
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

        {/* Teacher subject assignments (teacher_subjects provisioning) */}
        <TeacherAssignments flash={flash} />

      </div>
    </PortalLayout>
  );
}
