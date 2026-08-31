import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  GraduationCap,
  Calendar,
  ClipboardCheck,
  Award,
  Bell,
  User,
  BookOpen,
  Plus,
  RefreshCw,
  Check,
} from 'lucide-react';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

const ASSESSMENT_TYPES = [
  'assignment',
  'quiz',
  'midterm',
  'practical',
  'final',
  'other',
];

// Status chips use semantic tokens so they adapt to light/dark mode
// and keep success/warning/error/info meaning consistent app-wide.
const STATUS_STYLES = {
  present: 'bg-success/10 text-success-dark',
  absent: 'bg-error/10 text-error-dark',
  late: 'bg-warning/10 text-warning-dark',
  excused: 'bg-info/10 text-info-dark',
};

// Assessment types are categories, not statuses - neutral chips keep
// color meaning reserved for status semantics (design system section 4).
const TYPE_STYLES = {
  assignment: 'bg-text-muted/10 text-text-muted',
  quiz: 'bg-text-muted/10 text-text-muted',
  midterm: 'bg-text-muted/10 text-text-muted',
  practical: 'bg-text-muted/10 text-text-muted',
  final: 'bg-text-muted/10 text-text-muted',
  other: 'bg-text-muted/10 text-text-muted',
};

const CHIP_FALLBACK = 'bg-text-muted/10 text-text-muted';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-surface rounded-soft-lg shadow-soft p-5 flex items-start gap-4">
      <div className={`rounded-full p-3 ${accent || 'bg-primary/10 text-primary'}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-3xl font-bold text-text-main leading-tight">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-bold text-text-main mb-3">{children}</h2>;
}

function SelectField({ label, value, onChange, options, placeholder, disabled }) {
  const id = useId();
  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-sm text-text-muted block mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Attendance marking state
  const [attClass, setAttClass] = useState('');
  const [attDate, setAttDate] = useState('');
  const [attStudents, setAttStudents] = useState([]);
  const [attStatuses, setAttStatuses] = useState({});
  const [attLoading, setAttLoading] = useState(false);
  const [attMessage, setAttMessage] = useState('');

  // Marks entry state
  const [markAssessment, setMarkAssessment] = useState('');
  const [markClass, setMarkClass] = useState('');
  const [markStudents, setMarkStudents] = useState([]);
  const [markValues, setMarkValues] = useState({});
  const [markLoading, setMarkLoading] = useState(false);
  const [markMessage, setMarkMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        api.get('/teachers/me/dashboard'),
        api.get('/teachers/me/assessments'),
      ]);
      setData(d);
      setAssessments(a || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Derived: teacher's classes (subject+section pairs) from assigned subjects
  const classes = (data?.subjects || [])
    .filter((ts) => ts.sections)
    .map((ts) => ({
      value: `${ts.id}`,
      label: `${ts.subjects?.name || 'Subject'} · ${ts.sections?.name || 'Section'}${
        ts.semesters ? ` (${ts.semesters.name})` : ''
      }`,
      teacherSubject: ts,
    }));

  const selectedAttClass = classes.find((c) => c.value === attClass)?.teacherSubject || null;

  // Derived: subject options for assessment creation
  const subjectOptions = (data?.subjects || []).map((ts) => ({
    value: ts.id,
    label: `${ts.subjects?.name || 'Subject'}${ts.semesters ? ` (${ts.semesters.name})` : ''}`,
    subjectId: ts.subject_id,
    semesterId: ts.semester_id,
  }));

  async function loadAttendanceStudents() {
    if (!attClass || !attDate) return;
    setAttLoading(true);
    setAttMessage('');
    try {
      const sectionId = selectedAttClass?.sections?.id;
      if (!sectionId) throw new Error('Class has no section');
      const students = await api.get(`/sections/${sectionId}/students`);
      setAttStudents(students || []);
      const defaults = {};
      (students || []).forEach((s) => {
        defaults[s.id] = 'present';
      });
      setAttStatuses(defaults);
    } catch (e) {
      setAttMessage({ type: 'error', text: e.message });
    } finally {
      setAttLoading(false);
    }
  }

  async function submitAttendance() {
    if (!selectedAttClass || !attDate) return;
    setAttLoading(true);
    setAttMessage('');
    try {
      const records = attStudents.map((s) => ({
        studentId: s.id,
        status: attStatuses[s.id] || 'present',
      }));
      await api.post('/attendance', {
        subjectId: selectedAttClass.subject_id,
        sectionId: selectedAttClass.sections.id,
        date: attDate,
        records,
      });
      setAttMessage({ type: 'success', text: `Attendance saved for ${records.length} students.` });
    } catch (e) {
      setAttMessage({ type: 'error', text: e.message });
    } finally {
      setAttLoading(false);
    }
  }

  async function loadMarksStudents() {
    if (!markAssessment || !markClass) return;
    setMarkLoading(true);
    setMarkMessage('');
    try {
      const ts = classes.find((c) => c.value === markClass)?.teacherSubject;
      const sectionId = ts?.sections?.id;
      if (!sectionId) throw new Error('Class has no section');
      const students = await api.get(`/sections/${sectionId}/students`);
      setMarkStudents(students || []);
      const defaults = {};
      (students || []).forEach((s) => {
        defaults[s.id] = '';
      });
      setMarkValues(defaults);
    } catch (e) {
      setMarkMessage({ type: 'error', text: e.message });
    } finally {
      setMarkLoading(false);
    }
  }

  async function submitMarks() {
    if (!markAssessment) return;
    setMarkLoading(true);
    setMarkMessage('');
    try {
      const records = markStudents.map((s) => ({
        studentId: s.id,
        marksObtained: markValues[s.id] !== '' && markValues[s.id] != null
          ? Number(markValues[s.id])
          : 0,
        remarks: null,
      }));
      await api.post('/marks', { assessmentId: markAssessment, records });
      setMarkMessage({ type: 'success', text: `Marks saved for ${records.length} students.` });
    } catch (e) {
      setMarkMessage({ type: 'error', text: e.message });
    } finally {
      setMarkLoading(false);
    }
  }

  // New assessment form
  const [newAssess, setNewAssess] = useState({
    subjectId: '',
    semesterId: '',
    title: '',
    type: 'assignment',
    maxMarks: '',
    weightage: '',
    dateScheduled: '',
  });
  const [newAssessMsg, setNewAssessMsg] = useState('');
  const [newAssessBusy, setNewAssessBusy] = useState(false);

  async function createAssessment(e) {
    e.preventDefault();
    setNewAssessBusy(true);
    setNewAssessMsg('');
    try {
      await api.post('/teachers/me/assessments', {
        subjectId: newAssess.subjectId,
        semesterId: newAssess.semesterId,
        title: newAssess.title,
        type: newAssess.type,
        maxMarks: newAssess.maxMarks,
        weightage: newAssess.weightage || undefined,
        dateScheduled: newAssess.dateScheduled || undefined,
      });
      setNewAssessMsg({ type: 'success', text: 'Assessment created successfully.' });
      setNewAssess({
        subjectId: '',
        semesterId: '',
        title: '',
        type: 'assignment',
        maxMarks: '',
        weightage: '',
        dateScheduled: '',
      });
      // Refresh assessment list
      try {
        const a = await api.get('/teachers/me/assessments');
        setAssessments(a || []);
      } catch {
        /* non-fatal */
      }
    } catch (err) {
      setNewAssessMsg({ type: 'error', text: err.message });
    } finally {
      setNewAssessBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="bg-surface rounded-soft-lg shadow-soft p-8 text-center max-w-md">
          <p className="text-error font-medium mb-2">Unable to load your dashboard</p>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="btn-primary px-5 py-2 rounded-soft text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { profile, teacher, department } = data;
  const name = profile?.full_name || teacher?.employee_id || 'Teacher';
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'subjects', label: 'My Classes', icon: BookOpen },
    { id: 'attendance', label: 'Mark Attendance', icon: ClipboardCheck },
    { id: 'marks', label: 'Enter Marks', icon: Award },
    { id: 'assessments', label: 'Assessments', icon: Plus },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
  ];

  return (
    <div className="px-6 md:px-8 py-10 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-soft shrink-0">
          {initials}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-2xl font-bold text-text-main">{name}</h1>
          <p className="text-text-muted text-sm mt-1">
            {teacher?.designation || 'Faculty'} · {department?.name || 'Department'}
          </p>
          <p className="text-text-muted text-sm mt-0.5">Employee ID: {teacher?.employee_id || '—'}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Bell size={16} />
          <span>{data.unreadNotifications} unread</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <StatCard icon={BookOpen} label="Assigned Classes" value={classes.length} accent="bg-info/10 text-info-dark" />
        <StatCard icon={Calendar} label="Schedule Items" value={data.schedule?.length ?? 0} accent="bg-text-muted/10 text-text-muted" />
        <StatCard icon={ClipboardCheck} label="Sessions" value={data.sessionsCount ?? 0} accent="bg-success/10 text-success-dark" />
        <StatCard icon={Award} label="Assessments" value={assessments.length} accent="bg-warning/10 text-warning-dark" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-8 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                active ? 'btn-primary shadow-soft' : 'bg-bg-soft text-text-muted hover:text-primary'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>My Classes</SectionTitle>
              {classes.length ? (
                <ul className="space-y-3">
                  {classes.slice(0, 6).map((c) => (
                    <li key={c.value} className="text-sm flex items-start gap-2">
                      <BookOpen size={16} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-text-main">{c.label}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No classes assigned yet</p>
                  <p className="text-xs text-text-muted">Your assigned classes will appear here.</p>
                </div>
              )}
            </div>

            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>Recent Notifications</SectionTitle>
              {data.notifications?.length ? (
                <ul className="space-y-3">
                  {data.notifications.slice(0, 5).map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className="font-medium text-text-main">{n.title || 'Notification'}</p>
                      {n.message && <p className="text-text-muted text-xs mt-0.5">{n.message}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No notifications yet</p>
                  <p className="text-xs text-text-muted">College announcements will appear here.</p>
                </div>
              )}
            </div>

            {assessments.length > 0 && (
              <div className="bg-surface rounded-soft-lg shadow-soft p-6">
                <SectionTitle>Recent Assessments</SectionTitle>
                <ul className="space-y-3">
                  {assessments.slice(0, 5).map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium text-text-main">{a.title}</p>
                      <p className="text-text-muted text-xs mt-0.5">
                        {a.subjects?.name} · {a.type} · {a.max_marks} marks
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>Quick Actions</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTab('attendance')}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium"
                >
                  <ClipboardCheck size={16} /> Mark Attendance
                </button>
                <button
                  onClick={() => setTab('marks')}
                  className="btn-action-secondary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium"
                >
                  <Award size={16} /> Enter Marks
                </button>
                <button
                  onClick={() => setTab('assessments')}
                  className="flex items-center gap-2 px-4 py-2 rounded-soft bg-bg-soft text-text-main text-sm font-medium hover:text-primary transition"
                >
                  <Plus size={16} /> New Assessment
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'subjects' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>My Classes</SectionTitle>
            {classes.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-text-muted/25">
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Section</th>
                      <th className="py-2 pr-4">Semester</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => {
                      const ts = c.teacherSubject;
                      return (
                        <tr key={c.value} className="border-b border-text-muted/15">
                          <td className="py-2 pr-4 text-text-main">{ts.subjects?.name || '—'}</td>
                          <td className="py-2 pr-4 text-text-muted">{ts.subjects?.code || '—'}</td>
                          <td className="py-2 pr-4 text-text-main">{ts.sections?.name || '—'}</td>
                          <td className="py-2 pr-4 text-text-muted">{ts.semesters?.name || '—'}</td>
                          <td className="py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success-dark">
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted mb-2">No classes assigned yet</p>
                <p className="text-xs text-text-muted">Your assigned classes will appear here.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Mark Attendance</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                label="Class"
                value={attClass}
                onChange={(e) => {
                  setAttClass(e.target.value);
                  setAttStudents([]);
                  setAttStatuses({});
                  setAttMessage('');
                }}
                options={classes}
                placeholder="Select class"
              />
              <div>
                <label htmlFor="attendance-date" className="text-sm text-text-muted block mb-1">Date</label>
                <input
                  id="attendance-date"
                  type="date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadAttendanceStudents}
                  disabled={!attClass || !attDate || attLoading}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50 w-full justify-center"
                >
                  {attLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Load Students
                </button>
              </div>
            </div>

            {attMessage && (
              <p
                role="status"
                className={`mt-4 text-sm ${
                  attMessage.type === 'success' ? 'text-success-dark' : 'text-error'
                }`}
              >
                {attMessage.text}
              </p>
            )}

            {attStudents.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-muted">
                    {attStudents.length} student{attStudents.length === 1 ? '' : 's'} ·{' '}
                    {selectedAttClass?.subjects?.name} · {attDate}
                  </p>
                  <button
                    onClick={submitAttendance}
                    disabled={attLoading}
                    className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50"
                  >
                    {attLoading ? <Check size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Attendance
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-text-muted border-b border-text-muted/25">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Enrollment</th>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <th key={s} className="py-2 pr-4 capitalize">{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attStudents.map((s) => (
                        <tr key={s.id} className="border-b border-text-muted/15">
                          <td className="py-2 pr-4 text-text-main">
                            {s.profiles?.full_name || s.enrollment_number}
                          </td>
                          <td className="py-2 pr-4 text-text-muted">{s.enrollment_number}</td>
                          {ATTENDANCE_STATUSES.map((st) => {
                            const active = attStatuses[s.id] === st;
                            return (
                              <td key={st} className="py-2 pr-2">
                                <button
                                  onClick={() => setAttStatuses((prev) => ({ ...prev, [s.id]: st }))}
                                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                                    active
                                      ? STATUS_STYLES[st]
                                      : 'bg-bg-soft text-text-muted hover:text-primary'
                                  }`}
                                >
                                  {st}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'marks' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Enter Marks</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                label="Assessment"
                value={markAssessment}
                onChange={(e) => {
                  setMarkAssessment(e.target.value);
                  setMarkStudents([]);
                  setMarkValues({});
                  setMarkMessage('');
                }}
                options={assessments.map((a) => ({
                  value: a.id,
                  label: `${a.title} (${a.subjects?.name || 'Subject'} · ${a.type} · ${a.max_marks})`,
                }))}
                placeholder="Select assessment"
              />
              <SelectField
                label="Class"
                value={markClass}
                onChange={(e) => {
                  setMarkClass(e.target.value);
                  setMarkStudents([]);
                  setMarkValues({});
                  setMarkMessage('');
                }}
                options={classes}
                placeholder="Select class"
              />
              <div className="flex items-end">
                <button
                  onClick={loadMarksStudents}
                  disabled={!markAssessment || !markClass || markLoading}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50 w-full justify-center"
                >
                  {markLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Load Students
                </button>
              </div>
            </div>

            {markMessage && (
              <p
                role="status"
                className={`mt-4 text-sm ${
                  markMessage.type === 'success' ? 'text-success-dark' : 'text-error'
                }`}
              >
                {markMessage.text}
              </p>
            )}

            {markStudents.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-muted">
                    {markStudents.length} student{markStudents.length === 1 ? '' : 's'}
                  </p>
                  <button
                    onClick={submitMarks}
                    disabled={markLoading}
                    className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50"
                  >
                    {markLoading ? <Check size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Marks
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-text-muted border-b border-text-muted/25">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Enrollment</th>
                        <th className="py-2">Marks Obtained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markStudents.map((s) => {
                        const assessment = assessments.find((a) => a.id === markAssessment);
                        const max = assessment?.max_marks ?? 0;
                        return (
                          <tr key={s.id} className="border-b border-text-muted/15">
                            <td className="py-2 pr-4 text-text-main">
                              {s.profiles?.full_name || s.enrollment_number}
                            </td>
                            <td className="py-2 pr-4 text-text-muted">{s.enrollment_number}</td>
                            <td className="py-2">
                              <input
                                type="number"
                                aria-label={`Marks for ${s.profiles?.full_name || s.enrollment_number}`}
                                min="0"
                                max={max}
                                step="0.01"
                                value={markValues[s.id] ?? ''}
                                onChange={(e) =>
                                  setMarkValues((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                placeholder={`0 - ${max}`}
                                className="w-32 px-3 py-1.5 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'assessments' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>Create Assessment</SectionTitle>
              <form onSubmit={createAssessment} className="space-y-4">
                <SelectField
                  label="Subject & Semester"
                  value={newAssess.subjectId}
                  onChange={(e) => {
                    const opt = subjectOptions.find((o) => o.value === e.target.value);
                    setNewAssess((prev) => ({
                      ...prev,
                      subjectId: opt?.subjectId || '',
                      semesterId: opt?.semesterId || '',
                    }));
                  }}
                  options={subjectOptions}
                  placeholder="Select subject"
                />
                <div>
                  <label htmlFor="assessment-title" className="text-sm text-text-muted block mb-1">Title</label>
                  <input
                    id="assessment-title"
                    type="text"
                    required
                    value={newAssess.title}
                    onChange={(e) => setNewAssess((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Midterm Exam - Unit 1"
                    className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="assessment-type" className="text-sm text-text-muted block mb-1">Type</label>
                    <select
                      id="assessment-type"
                      value={newAssess.type}
                      onChange={(e) => setNewAssess((p) => ({ ...p, type: e.target.value }))}
                      className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                    >
                      {ASSESSMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="assessment-max-marks" className="text-sm text-text-muted block mb-1">Max Marks</label>
                    <input
                      id="assessment-max-marks"
                      type="number"
                      required
                      min="1"
                      value={newAssess.maxMarks}
                      onChange={(e) => setNewAssess((p) => ({ ...p, maxMarks: e.target.value }))}
                      placeholder="100"
                      className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="assessment-weightage" className="text-sm text-text-muted block mb-1">Weightage (%)</label>
                    <input
                      id="assessment-weightage"
                      type="number"
                      min="0"
                      max="100"
                      value={newAssess.weightage}
                      onChange={(e) => setNewAssess((p) => ({ ...p, weightage: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="assessment-scheduled-date" className="text-sm text-text-muted block mb-1">Scheduled Date</label>
                    <input
                      id="assessment-scheduled-date"
                      type="date"
                      value={newAssess.dateScheduled}
                      onChange={(e) => setNewAssess((p) => ({ ...p, dateScheduled: e.target.value }))}
                      className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                    />
                  </div>
                </div>

                {newAssessMsg && (
                  <p
                    role="status"
                    className={`text-sm ${
                      newAssessMsg.type === 'success' ? 'text-success-dark' : 'text-error'
                    }`}
                  >
                    {newAssessMsg.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={newAssessBusy}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50"
                >
                  {newAssessBusy ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                  Create Assessment
                </button>
              </form>
            </div>

            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>My Assessments</SectionTitle>
              {assessments.length ? (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-text-muted border-b border-text-muted/25">
                        <th className="py-2 pr-4">Title</th>
                        <th className="py-2 pr-4">Subject</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map((a) => (
                        <tr key={a.id} className="border-b border-text-muted/15">
                          <td className="py-2 pr-4 text-text-main">{a.title}</td>
                          <td className="py-2 pr-4 text-text-muted">{a.subjects?.name || '—'}</td>
                          <td className="py-2 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                TYPE_STYLES[a.type] || CHIP_FALLBACK
                              }`}
                            >
                              {a.type}
                            </span>
                          </td>
                          <td className="py-2 text-text-main">{a.max_marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No assessments yet</p>
                  <p className="text-xs text-text-muted">Assessments you create will appear here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Weekly Schedule</SectionTitle>
            {data.schedule?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-text-muted/25">
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Section</th>
                      <th className="py-2">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEK_DAYS.map((day) =>
                      data.schedule
                        .filter((t) => t.day_of_week === day)
                        .map((t) => (
                          <tr key={t.id} className="border-b border-text-muted/15">
                            <td className="py-2 pr-4 capitalize text-text-main">{day}</td>
                            <td className="py-2 pr-4 text-text-main">
                              {String(t.start_time).slice(0, 5)} – {String(t.end_time).slice(0, 5)}
                            </td>
                            <td className="py-2 pr-4 text-text-main">{t.subjects?.name || '—'}</td>
                            <td className="py-2 pr-4 text-text-muted">{t.sections?.name || '—'}</td>
                            <td className="py-2 text-text-main">{t.rooms?.room_number || '—'}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted mb-2">No schedule published yet</p>
                <p className="text-xs text-text-muted">Your teaching schedule will appear here once published.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-text-muted flex items-center justify-center gap-1">
        <GraduationCap size={14} /> Academic Portal · Teacher Dashboard
      </p>
    </div>
  );
}

export default TeacherDashboard;

