import { supabase } from '../lib/supabase';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/mbslogo.png';
import NewsTicker from './NewsTicker';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';
import { Sun, Moon, Menu, X, Megaphone, Home, BookOpen, Building2, Bot } from 'lucide-react';

const lightColors = {
  '--color-primary': '#353084',
  '--color-primary-dark': '#14204A',
  '--color-secondary': '#E8611C',
  '--color-bg-soft': '#F7F7F5',
  '--color-surface': '#F7F7F5',
  '--color-navbar': '#EEEEEE',
  '--color-text-main': '#212B36',
  '--color-text-muted': '#637381',
  '--shadow-soft': 'none',
  '--shadow-soft-lg': 'none',
  '--shadow-inset': 'none',
};

const darkColors = {
  '--color-primary': '#4A7FC9',
  '--color-primary-dark': '#6B9BDB',
  '--color-secondary': '#E8894A',
  '--color-bg-soft': '#1A1D23',
  '--color-surface': '#1A1D23',
  '--color-navbar': '#22262E',
  '--color-text-main': '#E8E9EB',
  '--color-text-muted': '#9CA3AF',
  '--shadow-soft': 'none',
  '--shadow-soft-lg': 'none',
  '--shadow-inset': 'none',
};

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
  const [darkMode, setDarkMode] = useState(false);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const colors = darkMode ? darkColors : lightColors;
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
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
            {navLinks.map((link) => (
              <li key={link.href} className="nav-link hover:text-primary transition">
                <Link to={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden px-6 mt-2">
          <nav className="mobile-menu bg-navbar shadow-soft rounded-soft-lg px-5 py-4">
            <ul className="flex flex-col gap-3 text-text-main font-medium text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} onClick={() => setMenuOpen(false)} className="block py-1 hover:text-primary transition">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-black/10 pt-3">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navbar border-t border-black/10 z-50">
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
            <Megaphone size={20} />
            <span className="text-xs">Gallery</span>
          </Link>
          {session && (
            <div className="flex flex-col items-center gap-1 text-primary">
              <Bot size={20} />
              <span className="text-xs font-medium">AI</span>
            </div>
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