import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import PortalLayout from '../components/PortalLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Users,
  UserCheck,
  BookOpen,
  ClipboardCheck,
  Award,
  Newspaper,
  Bell,
  Bot,
  LayoutDashboard,
  Building2,
  BookMarked,
  CalendarRange,
  DoorOpen,
  AlertCircle,
} from 'lucide-react';

/**
 * Admin landing dashboard. Functional modules (News, AI Agent,
 * Notifications, Profile) link to real pages; the rest are explicitly
 * labelled "Coming soon" — nothing is pretended to be functional.
 */
const MODULE_CARDS = [
  { key: 'users', title: 'User Management', description: 'Provision student, teacher and admin accounts; view the user directory.', icon: Users, to: '/admin/users', comingSoon: false },
  { key: 'teacher-management', title: 'Teacher Management', description: 'Manage faculty profiles and department assignments.', icon: UserCheck, to: null, comingSoon: true },
  { key: 'academic-records', title: 'Academic Records', description: 'Courses, semesters, sections and academic structure.', icon: BookOpen, to: null, comingSoon: true },
  { key: 'attendance', title: 'Attendance', description: 'Monitor and manage attendance across all classes.', icon: ClipboardCheck, to: null, comingSoon: true },
  { key: 'marks', title: 'Marks', description: 'Approve and manage assessment marks and results.', icon: Award, to: null, comingSoon: true },
  { key: 'news', title: 'News', description: 'Review, verify and publish news items and sources.', icon: Newspaper, to: '/admin/news', comingSoon: false },
  { key: 'notifications', title: 'Notifications', description: 'Broadcast announcements and view notification centre.', icon: Bell, to: '/notifications', comingSoon: false },
  { key: 'agent', title: 'AI Agent', description: 'News discovery agent, runs and AI assistant tooling.', icon: Bot, to: '/admin/agent', comingSoon: false },
];

const SYSTEM_STATS = [
  { key: 'departments', label: 'Departments', icon: Building2, path: '/api/departments' },
  { key: 'subjects', label: 'Subjects', icon: BookMarked, path: '/api/subjects' },
  { key: 'semesters', label: 'Semesters', icon: CalendarRange, path: '/api/semesters' },
  { key: 'rooms', label: 'Rooms', icon: DoorOpen, path: '/api/rooms' },
];
export default function AdminDashboard() {
  const [name, setName] = useState('');
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, ...results] = await Promise.all([
        api.get('/profile/me'),
        ...SYSTEM_STATS.map((s) => api.get(s.path).catch(() => null)),
      ]);
      setName(me?.profile?.full_name || 'Administrator');
      const next = {};
      SYSTEM_STATS.forEach((s, i) => {
        const rows = results[i];
        if (Array.isArray(rows)) next[s.key] = rows.length;
      });
      setCounts(next);
    } catch {
      // Dashboard still renders; stats stay empty.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PortalLayout>
      <div className="px-6 md:px-8 py-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wide">Administration</p>
              <h1 className="text-2xl font-bold text-text-main mt-1">{name || 'Admin Dashboard'}</h1>
              <p className="text-text-muted text-sm mt-1">
                MBSCET Central Admin Portal — manage news, agent runs and institute data.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <LayoutDashboard size={16} className="text-primary" />
              <span>System overview</span>
            </div>
          </div>
        </div>

        {/* System overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {SYSTEM_STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="bg-surface rounded-soft-lg shadow-soft p-4 flex items-center gap-3">
                <div className="rounded-full p-2.5 bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-main leading-tight">
                    {loading ? '—' : counts[s.key] ?? '—'}
                  </p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
{/* Module cards */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-text-main mb-3">Admin Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULE_CARDS.map((card) => {
              const Icon = card.icon;
              const body = (
                <>
                  <div className="flex items-start justify-between">
                    <div className={`rounded-full p-3 ${card.comingSoon ? 'bg-text-muted/10 text-text-muted' : 'bg-primary/10 text-primary'}`}>
                      <Icon size={22} />
                    </div>
                    {card.comingSoon && (
                      <span className="px-2 py-0.5 rounded-full bg-text-muted/10 text-text-muted text-xs font-semibold uppercase tracking-wide">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-text-main mt-4">{card.title}</h3>
                  <p className="text-sm text-text-muted mt-1 leading-snug">{card.description}</p>
                </>
              );
              return card.to ? (
                <Link
                  key={card.key}
                  to={card.to}
                  className="bg-surface rounded-soft-lg shadow-soft p-5 hover:-translate-y-0.5 transition block"
                >
                  {body}
                </Link>
              ) : (
                <div key={card.key} className="bg-surface rounded-soft-lg shadow-soft p-5 opacity-75" aria-disabled="true">
                  {body}
                  <p className="text-xs text-text-muted mt-3 flex items-center gap-1">
                    <AlertCircle size={12} /> Not implemented yet in this demo version.
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <LayoutDashboard size={14} /> Academic Portal · Admin Dashboard
        </p>
      </div>
    </PortalLayout>
  );
}