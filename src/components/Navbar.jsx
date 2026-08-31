import { supabase } from '../lib/supabase';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/mbslogo.png';
import NewsTicker from './NewsTicker';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';
import { Sun, Moon, Menu, X, Images, Home, BookOpen, Building2, Bot } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Admissions', href: '/admissions' },
  { label: 'Departments', href: '/departments' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'News', href: '/news' },
  { label: 'Placements', href: '/placement' },
  { label: 'Contact', href: '/contact' },
];

function Navbar() {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('mbscet-theme');
      if (saved) return saved === 'dark';
    } catch {
      // localStorage unavailable — fall through to system preference
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  });
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Theme switching: toggle the `dark` class on <html> and persist the
  // choice. All palette values live in src/index.css (:root + html.dark);
  // the pre-paint script in index.html applies the saved theme before
  // first paint so there is never a flash of the wrong theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('mbscet-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors — theme still applies for this session
    }
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          setRole(profile?.role || null);
        } catch {
          setRole(null);
        }
      } else {
        setRole(null);
      }
    }
    load();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          setRole(profile?.role || null);
        } catch {
          setRole(null);
        }
      } else {
        setRole(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const dashboardPath =
    role === 'student'
      ? '/student-dashboard'
      : role === 'teacher'
        ? '/teacher-dashboard'
        : role === 'admin' || role === 'super_admin'
          ? '/admin-dashboard'
          : null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
  };

  return (
    <div className="relative w-full pb-6">
      {/* Top row: brand text left, toggle + Apply Now (desktop) / hamburger (mobile) right */}
      <div className="w-full flex items-center justify-between px-6 md:px-8 pt-6">
        <div className="text-sm font-bold text-text-main leading-tight">
          MBSCET <span className="text-primary block text-xs font-medium">Jammu</span>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 rounded-full bg-navbar shadow-soft flex items-center justify-center hover:shadow-soft-lg active:shadow-inset transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="text-primary" size={18} /> : <Moon className="text-primary" size={18} />}
          </button>

          {session && <NotificationBell />}

          {session ? (
            <>
              {dashboardPath && (
                <Link
                  to={dashboardPath}
                  className="text-sm font-medium text-primary hover:underline transition"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-text-main hover:text-primary transition"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm font-medium text-text-main hover:text-primary transition"
            >
              Login
            </Link>
          )}

          <Link
            to="/admissions"
            className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition text-sm"
          >
            Apply Now
          </Link>
        </div>

        {/* Mobile controls: dark toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-9 h-9 rounded-full bg-navbar shadow-soft flex items-center justify-center active:shadow-inset transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="text-primary" size={16} /> : <Moon className="text-primary" size={16} />}
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-full bg-navbar shadow-soft flex items-center justify-center active:shadow-inset transition"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X className="text-primary" size={18} /> : <Menu className="text-primary" size={18} />}
          </button>
        </div>
      </div>

      {/* Logo, centered */}
      <div className="flex justify-center -mt-2 md:-mt-4 mb-2 md:mb-4">
        <img src={logo} alt="MBSCET Jammu Logo" className="h-20 w-20 md:h-30 md:w-30 object-contain" />
      </div>

      {/* Desktop nav pill */}
      <div className="hidden md:flex justify-center">
        <nav className="bg-navbar shadow-soft rounded-full px-8 py-3">
          <ul className="flex gap-8 text-text-main font-medium text-sm">
            {navLinks.map((link) => {
              const active = location.pathname === link.href;
              return (
                <li
                  key={link.href}
                  className={`nav-link transition ${
                    active ? 'text-primary font-semibold' : 'hover:text-primary'
                  }`}
                >
                  <Link to={link.href} aria-current={active ? 'page' : undefined}>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden px-6 mt-2">
          <nav id="mobile-menu" className="mobile-menu bg-navbar shadow-soft rounded-soft-lg px-5 py-4">
            <ul className="flex flex-col gap-3 text-text-main font-medium text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} onClick={() => setMenuOpen(false)} className="block py-1 hover:text-primary transition">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-text-muted/25 pt-3">
                {session ? (
                  <button
                    onClick={handleLogout}
                    className="block text-left w-full hover:text-primary transition"
                  >
                    Logout
                  </button>
                ) : (
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="block hover:text-primary transition">
                    Login
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* News ticker — sits below nav on all breakpoints */}
      <div className="px-6 md:px-8 mt-4">
        <NewsTicker />
      </div>

      {/* Mobile bottom navigation bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navbar border-t border-text-muted/25 z-50">
        <div className="flex justify-around items-center py-3">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-primary' : 'text-text-muted'}`}
            onClick={() => setMenuOpen(false)}
          >
            <Home size={20} />
            <span className="text-xs">Home</span>
          </Link>
          <Link
            to="/departments"
            className={`flex flex-col items-center gap-1 ${location.pathname === '/departments' ? 'text-primary' : 'text-text-muted'}`}
            onClick={() => setMenuOpen(false)}
          >
            <BookOpen size={20} />
            <span className="text-xs">Departments</span>
          </Link>
          <Link
            to="/gallery"
            className={`flex flex-col items-center gap-1 ${location.pathname === '/gallery' ? 'text-primary' : 'text-text-muted'}`}
            onClick={() => setMenuOpen(false)}
          >
            <Images size={20} />
            <span className="text-xs">Gallery</span>
          </Link>
          {session && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('mbscet:open-ai-assistant'))}
              className="flex flex-col items-center gap-1 text-primary"
              aria-label="Open AI assistant"
            >
              <Bot size={20} />
              <span className="text-xs font-medium">AI</span>
            </button>
          )}
          <Link
            to="/admissions"
            className="flex flex-col items-center gap-1 text-primary"
            onClick={() => setMenuOpen(false)}
          >
            <Building2 size={20} />
            <span className="text-xs font-medium">Apply</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Navbar;