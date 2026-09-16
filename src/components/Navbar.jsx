import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/mbslogo.png';
import NewsTicker from './NewsTicker';
import NotificationBell from './NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dashboardPathForRole, signOut } from '../lib/auth';
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
  // Session + authoritative role come from the shared session store (one
  // Supabase subscription and one server-resolved role per page load) — this
  // component previously kept its own duplicate copy of both.
  const { user, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Lazy initializers keep the bar correct when the page is restored
  // mid-scroll (reload / back-navigation) instead of flashing unscrolled.
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 100);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const headerRef = useRef(null);

  // Scroll driver. `isScrolled` keeps the original binary threshold (mobile
  // bar + a11y visibility guards); `--nav-p` (0→1 over the first 100px of
  // scroll) is written straight to the header's inline style so the desktop
  // morph rules in index.css interpolate continuously with scroll — no
  // per-frame React re-render, and scrolling back up reverses the animation.
  useEffect(() => {
    let raf = 0;
    const MORPH_SPAN_PX = 100;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setIsScrolled(y > 100);
      headerRef.current?.style.setProperty(
        '--nav-p',
        String(Math.min(1, Math.max(0, y / MORPH_SPAN_PX)))
      );
    };

    const handleScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  const dashboardPath = profile?.role ? dashboardPathForRole(profile.role) : null;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Best effort: the shared auth listener clears the session locally even
      // if the server sign-out call fails.
    }
    setMenuOpen(false);
  };

  // Handle keyboard navigation for mobile menu
  const handleMenuKeyDown = (e) => {
    if (e.key === 'Escape') {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
  };

  // Focus trap for mobile menu
  useEffect(() => {
    if (menuOpen && menuRef.current) {
      const currentMenuRef = menuRef.current;
      const focusableElements = currentMenuRef.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Small delay to ensure menu is rendered before focusing
      setTimeout(() => {
        firstElement?.focus();
      }, 50);

      const handleTab = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      currentMenuRef.addEventListener('keydown', handleTab);
      return () => currentMenuRef.removeEventListener('keydown', handleTab);
    }
  }, [menuOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target) && !menuButtonRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    // Position: in-flow `relative` below md (original mobile behaviour — mobile
    // navigation lives in the fixed bottom bar, and pinning the tall header
    // would swallow a phone viewport), `sticky` from md up so the compact
    // scrolled nav stays pinned. Sticky's containing block is #root (full page
    // height — verified free of overflow/transform ancestors), so the bar stays
    // pinned at every scroll depth. The background appears only once scrolled —
    // the initial hero presentation stays clean.
    <div
      ref={headerRef}
      className={`nav-root relative w-full transition-all duration-300 md:sticky md:top-0 md:z-50 ${isScrolled ? 'pb-2 bg-navbar border-b border-text-muted/25 md:bg-transparent md:border-b-0' : 'pb-6'}`}
    >
      {/* Desktop-only continuous bar background + border: fades in with
          --nav-p instead of popping at the threshold. Mobile keeps the
          binary toggle on the root above (md:* classes are no-ops there). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navbar border-b border-text-muted/25 pointer-events-none -z-10 hidden md:block"
        style={{ opacity: 'var(--nav-p, 0)' }}
      />
      {/* Top row: brand text left, toggle + Apply Now (desktop) / hamburger (mobile) right */}
      <div className={`nav-morph-toprow w-full flex items-center justify-between px-6 md:px-8 transition-all duration-300 ${isScrolled ? 'pt-3' : 'pt-6'}`}>
        <div className={`nav-morph-brand font-bold text-text-main leading-tight transition-all duration-300 ${isScrolled ? 'text-xs' : 'text-sm'}`}>
          <span className={`block transition-all duration-300 ${isScrolled ? 'hidden md:block' : 'block'}`}>
            MBSCET <span className="text-primary block text-xs font-medium">Jammu</span>
          </span>
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

          {user && <NotificationBell />}

          {user ? (
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
            ref={menuButtonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-full bg-navbar shadow-soft flex items-center justify-center active:shadow-inset transition focus:ring-2 focus:ring-primary/50"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X className="text-primary" size={18} /> : <Menu className="text-primary" size={18} />}
          </button>
        </div>
      </div>

      {/* Logo: the existing grow/shrink + center→left animation, now driven
          continuously by scroll on desktop (index.css consumes --nav-p).
          The invisible flex spacers interpolate the old justify-content
          swap so the logo glides left instead of teleporting; mobile keeps
          the original binary classes untouched. The lockup adds the
          MBSCET + Jammu branding beside the logo in the compact bar. */}
      <div className={`nav-morph-logo-row transition-all duration-300 flex items-center ${isScrolled ? 'justify-start px-6 md:px-8 -mt-2' : 'justify-center -mt-2 md:-mt-4'} mb-2 md:mb-4`}>
        <div aria-hidden="true" className="hidden md:block flex-1 nav-morph-spacer-l" />
        <div className="relative shrink-0">
          <img
            src={logo}
            alt="MBSCET Jammu Logo"
            className={`nav-morph-logo object-contain transition-all duration-300 ${isScrolled ? 'h-12 w-12' : 'h-20 w-20 md:h-30 md:w-30'}`}
          />
          <div aria-hidden="true" className="nav-morph-lockup absolute left-full top-1/2 ml-3 hidden md:block whitespace-nowrap">
            <span className="block font-bold text-text-main text-sm leading-tight">MBSCET</span>
            <span className="block text-primary text-xs font-medium leading-tight">Jammu</span>
          </div>
        </div>
        <div aria-hidden="true" className="hidden md:block flex-1" />
      </div>

      {/* Desktop nav pill (expanded state) — always mounted on md+. Its band
          collapses and the pill fades upward as --nav-p → 1, crossfading
          into the compact pill below instead of display-swapping. The
          md:invisible endpoint guard keeps it out of tab order / the
          accessibility tree once fully scrolled (mobile stays hidden). */}
      <div className={`nav-morph-pill-expanded ${isScrolled ? 'md:invisible' : ''} hidden justify-center md:flex`}>
        <nav className="bg-navbar shadow-soft rounded-full px-8 py-3">
          <ul className="flex gap-8 text-text-main font-medium text-sm">
            {navLinks.map((link) => {
              const active = location.pathname === link.href;
              return (
                <li
                  key={link.href}
                  className={`nav-link transition ${
                    active ? 'text-primary font-semibold bg-bg-soft/50 rounded-soft px-3 py-1' : 'hover:text-primary'
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

      {/* Compact nav pill on scroll — renders the FULL navLinks list (the old
          slice(0, 4) dropped Gallery/News/Placements/Contact from the DOM).
          Its band grows and it fades/slides in with --nav-p while the
          expanded pill fades out; md:invisible below the threshold keeps it
          out of tab order / the accessibility tree (mobile stays hidden). */}
      <div className={`nav-morph-pill-compact ${isScrolled ? 'justify-start px-8 md:flex' : 'hidden md:flex md:invisible'}`}>
        <nav className="bg-navbar shadow-soft rounded-full px-6 py-2">
          <ul className="flex gap-6 text-text-main font-medium text-xs">
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
          <nav
            ref={menuRef}
            id="mobile-menu"
            className="mobile-menu bg-navbar shadow-soft rounded-soft-lg px-5 py-4"
            onKeyDown={handleMenuKeyDown}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col gap-3 text-text-main font-medium text-sm">
              {navLinks.map((link) => {
                const active = location.pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block py-1 transition ${
                        active ? 'text-primary font-semibold bg-bg-soft/50 rounded-soft px-3 py-1' : 'hover:text-primary'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              <li className="border-t border-text-muted/25 pt-3">
                {user ? (
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
      <div className={`nav-morph-ticker px-6 md:px-8 transition-all duration-300 ${isScrolled ? 'mt-2' : 'mt-4'}`}>
        <NewsTicker />
      </div>

      {/* Mobile bottom navigation bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navbar border-t border-text-muted/25 z-50">
        <div className="flex justify-around items-center py-3">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 transition ${
              location.pathname === '/' ? 'text-primary font-semibold' : 'text-text-muted'
            }`}
            onClick={() => setMenuOpen(false)}
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            <Home size={20} />
            <span className="text-xs">Home</span>
          </Link>
          <Link
            to="/departments"
            className={`flex flex-col items-center gap-1 transition ${
              location.pathname === '/departments' ? 'text-primary font-semibold' : 'text-text-muted'
            }`}
            onClick={() => setMenuOpen(false)}
            aria-current={location.pathname === '/departments' ? 'page' : undefined}
          >
            <BookOpen size={20} />
            <span className="text-xs">Departments</span>
          </Link>
          <Link
            to="/gallery"
            className={`flex flex-col items-center gap-1 transition ${
              location.pathname === '/gallery' ? 'text-primary font-semibold' : 'text-text-muted'
            }`}
            onClick={() => setMenuOpen(false)}
            aria-current={location.pathname === '/gallery' ? 'page' : undefined}
          >
            <Images size={20} />
            <span className="text-xs">Gallery</span>
          </Link>
          {user && (
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