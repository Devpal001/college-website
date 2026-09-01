import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import PortalLayout from '../components/PortalLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  GraduationCap,
  Calendar,
  ClipboardCheck,
  Award,
  Bell,
  User,
  BookOpen,
} from 'lucide-react';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-surface rounded-soft-lg shadow-soft p-5 flex items-start gap-4">
      <div className={`rounded-full p-3 ${accent || 'bg-primary/10 text-primary'}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-3xl font-bold text-text-main leading-tight">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, color }) {
  return (
    <div className="w-full h-2 rounded-full bg-bg-soft overflow-hidden">
      <div
        className={`h-full rounded-full ${color || 'bg-primary'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-bold text-text-main mb-3">{children}</h2>;
}

function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const VALID_TABS = ['overview', 'attendance', 'marks', 'timetable'];
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(VALID_TABS.includes(initialTab) ? initialTab : 'overview');

  // Keep the URL ?tab= synced so PortalLayout nav and deep links work.
  const changeTab = (id) => {
    setTab(id);
    const params = new URLSearchParams(searchParams);
    if (id === 'overview') params.delete('tab');
    else params.set('tab', id);
    setSearchParams(params, { replace: true });
  };

  const loadDashboard = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const d = await api.get('/students/me/dashboard');
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  const { profile, student, department, semester, section, attendanceSummary, marksSummary } = data;
  const name = profile?.full_name || student?.enrollment_number || 'Student';
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'marks', label: 'Marks', icon: Award },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
  ];

  return (
    <PortalLayout>
      <div className="px-6 md:px-8 py-10 max-w-6xl mx-auto">
      {/* Header card */}
      <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-soft shrink-0">
          {initials}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-2xl font-bold text-text-main">{name}</h1>
          <p className="text-text-muted text-sm mt-1">
            {department?.name || 'Department'} ·{' '}
            {semester?.name || `Semester ${student?.current_semester || '—'}`}
            {section?.name ? ` · Section ${section.name}` : ''}
          </p>
          <p className="text-text-muted text-sm mt-0.5">
            Enrollment: {student?.enrollment_number || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Bell size={16} />
          <span>{data.unreadNotifications} unread</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <StatCard
          icon={ClipboardCheck}
          label="Attendance"
          value={attendanceSummary?.total ? `${attendanceSummary.percentage}%` : '—'}
          sub={`${attendanceSummary?.presentCount ?? 0}/${attendanceSummary?.total ?? 0} classes attended`}
          accent="bg-success/10 text-success-dark"
        />
        <StatCard
          icon={Award}
          label="Overall Marks"
          value={marksSummary?.maxSum ? `${marksSummary.overallPercentage}%` : '—'}
          sub={`${marksSummary?.obtainedSum ?? 0} / ${marksSummary?.maxSum ?? 0} total`}
          accent="bg-warning/10 text-warning-dark"
        />
        <StatCard
          icon={BookOpen}
          label="Unread Notifications"
          value={data.unreadNotifications ?? 0}
          sub="Latest updates for you"
          accent="bg-info/10 text-info-dark"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-8 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                active
                  ? 'btn-primary shadow-soft'
                  : 'bg-bg-soft text-text-muted hover:text-primary'
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
              <SectionTitle>Attendance by Subject</SectionTitle>
              {data.attendanceBySubject?.length ? (
                <ul className="space-y-4">
                  {data.attendanceBySubject.map((b) => (
                    <li key={b.subject.id || b.subject.code}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-text-main">
                          {b.subject.name}
                          {b.subject.code ? ` (${b.subject.code})` : ''}
                        </span>
                        <span className="text-text-muted">{b.percentage}%</span>
                      </div>
                      <ProgressBar value={b.percentage} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No attendance records yet</p>
                  <p className="text-xs text-text-muted">Attendance will appear here once your teachers submit records.</p>
                </div>
              )}
            </div>

            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
              <SectionTitle>Marks by Subject</SectionTitle>
              {marksSummary?.bySubject?.length ? (
                <ul className="space-y-4">
                  {marksSummary.bySubject.map((b) => (
                    <li key={b.subject.id || b.subject.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-text-main">{b.subject.name}</span>
                        <span className="text-text-muted">
                          {b.obtained}/{b.max} · {b.percentage}%
                        </span>
                      </div>
                      <ProgressBar value={b.percentage} color="bg-secondary" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No marks recorded yet</p>
                  <p className="text-xs text-text-muted">Marks will appear here once your teachers enter grades.</p>
                </div>
              )}
            </div>

            {data.announcements?.length > 0 && (
              <div className="bg-surface rounded-soft-lg shadow-soft p-6">
                <SectionTitle>Announcements</SectionTitle>
                <ul className="space-y-3">
                  {data.announcements.slice(0, 5).map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium text-text-main">{a.title}</p>
                      {a.content && (
                        <p className="text-text-muted text-xs mt-0.5">{a.content}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.events?.length > 0 && (
              <div className="bg-surface rounded-soft-lg shadow-soft p-6">
                <SectionTitle>Upcoming Events</SectionTitle>
                <ul className="space-y-3">
                  {data.events.map((e) => (
                    <li key={e.id} className="text-sm flex items-start gap-2">
                      <Calendar size={16} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-text-main">{e.title}</p>
                        <p className="text-text-muted text-xs">{e.event_date}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Attendance Records</SectionTitle>
            {data.attendance?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-text-muted/25">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Teacher</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map((r) => {
                      const s = r.attendance_sessions;
                      return (
                        <tr key={r.id} className="border-b border-text-muted/15">
                          <td className="py-2 pr-4 text-text-main">{s?.date || '—'}</td>
                          <td className="py-2 pr-4 text-text-main">
                            {s?.subjects?.name || s?.subject_id || '—'}
                          </td>
                          <td className="py-2 pr-4 text-text-muted">
                            {s?.teachers?.profiles?.full_name || s?.teachers?.employee_id || '—'}
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                STATUS_STYLES[r.status] || CHIP_FALLBACK
                              }`}
                            >
                              {r.status}
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
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted mb-2">No attendance records yet</p>
                <p className="text-xs text-text-muted">Your attendance records will appear here once submitted.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'marks' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Assessments & Marks</SectionTitle>
            {marksSummary?.byAssessment?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-text-muted/25">
                      <th className="py-2 pr-4">Assessment</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Marks</th>
                      <th className="py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksSummary.byAssessment.map((a) => (
                      <tr key={a.assessment.id} className="border-b border-text-muted/15">
                        <td className="py-2 pr-4 text-text-main">{a.assessment.title}</td>
                        <td className="py-2 pr-4 text-text-main">
                          {a.assessment.subjects?.name || '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              TYPE_STYLES[a.assessment.type] || CHIP_FALLBACK
                            }`}
                          >
                            {a.assessment.type}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-text-main">
                          {a.obtained} / {a.max}
                        </td>
                        <td className="py-2 text-text-main">{a.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                <p className="text-sm text-text-muted mb-2">No marks recorded yet</p>
                <p className="text-xs text-text-muted">Your assessment marks will appear here once graded.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'timetable' && (
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <SectionTitle>Weekly Timetable</SectionTitle>
            {data.timetable?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-text-muted/25">
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Teacher</th>
                      <th className="py-2">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEK_DAYS.map((day) =>
                      data.timetable
                        .filter((t) => t.day_of_week === day)
                        .map((t) => (
                          <tr key={t.id} className="border-b border-text-muted/15">
                            <td className="py-2 pr-4 capitalize text-text-main">{day}</td>
                            <td className="py-2 pr-4 text-text-main">
                              {String(t.start_time).slice(0, 5)} – {String(t.end_time).slice(0, 5)}
                            </td>
                            <td className="py-2 pr-4 text-text-main">
                              {t.subjects?.name || '—'}
                            </td>
                            <td className="py-2 pr-4 text-text-muted">
                              {t.teachers?.profiles?.full_name || t.teachers?.employee_id || '—'}
                            </td>
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
                <p className="text-sm text-text-muted mb-2">No timetable published yet</p>
                <p className="text-xs text-text-muted">Your weekly schedule will appear here once published.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-text-muted flex items-center justify-center gap-1">
        <GraduationCap size={14} /> Academic Portal · Student Dashboard
      </p>
      </div>
    </PortalLayout>
  );
}

export default StudentDashboard;

