import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/auth';
import {
  LayoutDashboard,
  ClipboardCheck,
  Award,
  Bell,
  User,
  BookOpen,
  Bot,
  Newspaper,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

/**
 * Role-aware portal navigation bar shown at the top of every portal page.
 * Wrapping a page in <PortalLayout> also adds the demo badge + logout so
 * the public Navbar can keep showing the public college website.
 */

const ROLE_META = {
  student: { label: 'Student Portal', href: '/student-dashboard' },
  teacher: { label: 'Teacher Portal', href: '/teacher-dashboard' },
  admin: { label: 'Admin Portal', href: '/admin-dashboard' },
  super_admin: { label: 'Admin Portal', href: '/admin-dashboard' },
};

const NAV_BY_ROLE = {
  student: [
    { label: 'Dashboard', to: '/student-dashboard', icon: LayoutDashboard },
    { label: 'Attendance', to: '/student-dashboard?tab=attendance', icon: ClipboardCheck },
    { label: 'Marks', to: '/student-dashboard?tab=marks', icon: Award },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  teacher: [
    { label: 'Dashboard', to: '/teacher-dashboard', icon: LayoutDashboard },
    { label: 'My Classes', to: '/teacher-dashboard?tab=subjects', icon: BookOpen },
    { label: 'Attendance', to: '/teacher-dashboard?tab=attendance', icon: ClipboardCheck },
    { label: 'Marks', to: '/teacher-dashboard?tab=marks', icon: Award },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin-dashboard', icon: LayoutDashboard },
    { label: 'News', to: '/admin/news', icon: Newspaper },
    { label: 'AI Agent', to: '/admin/agent', icon: Bot },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Profile', to: '/profile', icon: User },
  ],
  super_admin: [
    { label: 'Dashboard', to: '/admin-dashboard', icon: LayoutDashboard },
    { label: 'News', to: '/admin/news', icon: Newspaper },
    { label: 'AI Agent', to: '/admin/agent', icon: Bot },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Profile', to: '/profile', icon: User },
  ],
};
export default function PortalLayout({ children }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = profile?.role || 'student';
  const links = NAV_BY_ROLE[role] || NAV_BY_ROLE.student;
  const meta = ROLE_META[role] || ROLE_META.student;

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const initials = (profile?.full_name || 'MBSCET')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isActive = (to) => {
    const [path, query] = to.split('?');
    if (path !== location.pathname) return false;
    if (!query) return true;
    const expected = new URLSearchParams(query).get('tab');
    const actual = new URLSearchParams(location.search).get('tab');
    return actual === expected;
  };

  return (
    <div>
      {/* Portal top bar */}
      <div className="bg-primary text-white">
        <div className="px-6 md:px-8 py-3 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-white/80 flex items-center gap-1">
                <ShieldCheck size={12} /> {meta.label}
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Portal navigation">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    active ? 'bg-white text-primary' : 'text-white/85 hover:bg-white/15'
                  }`}
                >
                  <Icon size={15} />
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white/85 hover:bg-white/15 transition ml-1"
            >
              <LogOut size={15} /> Logout
            </button>
          </nav>
        </div>

        {/* Mobile / tablet nav (horizontal scroll) */}
        <div className="lg:hidden px-4 pb-3 -mt-1 overflow-x-auto">
          <div className="flex items-center gap-2 w-max">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 whitespace-nowrap transition ${
                    active ? 'bg-white text-primary' : 'hover:bg-white/20'
                  }`}
                >
                  <Icon size={13} />
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 whitespace-nowrap transition"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="sr-only">{user ? 'Signed in' : 'Not signed in'}</div>

      {children}
    </div>
  );
}