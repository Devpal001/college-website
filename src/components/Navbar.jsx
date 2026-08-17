import { Link } from 'react-router-dom';
import logo from '../assets/mbslogo.png';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

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

function Navbar() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const colors = darkMode ? darkColors : lightColors;
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [darkMode]);

  return (
    // ...rest of your JSX stays exactly the same
    <div className="relative w-full pb-6">
      {/* Top row: brand text left, toggle + Apply Now right */}
      <div className="w-full flex items-center justify-between px-8 pt-6">
        <div className="text-sm font-bold text-text-main leading-tight">
          MBSCET <span className="text-primary block text-xs font-medium">Jammu</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-10 h-10 rounded-full bg-navbar shadow-soft flex items-center justify-center hover:shadow-soft-lg active:shadow-inset transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="text-primary" size={18} /> : <Moon className="text-primary" size={18} />}
          </button>

          <Link
            to="/admissions"
            className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition text-sm"
          >
            Apply Now
          </Link>
        </div>
      </div>

      {/* Logo, centered */}
      <div className="flex justify-center -mt-4 mb-4">
        <img src={logo} alt="MBSCET Jammu Logo" className="h-30 w-30 object-contain" />
      </div>

      {/* Nav pill, centered, sits below the logo in normal flow */}
      <div className="flex justify-center">
        <nav className="bg-navbar shadow-soft rounded-full px-8 py-3">
          <ul className="flex gap-8 text-gray-600 font-medium text-sm">
            <li className="nav-link hover:text-primary transition">
              <Link to="/">Home</Link>
            </li>
            <li className="nav-link hover:text-primary transition">
              <Link to="/about">About</Link>
            </li>
            <li className="nav-link hover:text-primary transition">
              <Link to="/admissions">Admissions</Link>
            </li>
            <li className="nav-link hover:text-primary transition">
              <Link to="/contact">Contact</Link>
            </li>
            <li className="nav-link hover:text-primary transition">
              <Link to="/departments">Departments</Link>
            </li>
            <li className="nav-link hover:text-primary transition">
              <Link to="/campus-life">Campus Life</Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Navbar;