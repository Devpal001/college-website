import { Link } from 'react-router-dom';
import logo from '../assets/mbslogo.png';

function Navbar() {
  return (
    <div className="relative w-full pb-6">
      {/* Top row: brand text left, Apply Now right */}
      <div className="w-full flex items-center justify-between px-8 pt-6">
        <div className="text-sm font-bold text-text-main leading-tight">
          MBSCET <span className="text-primary block text-xs font-medium">Jammu</span>
        </div>

        <button className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition text-sm">
          Apply Now
        </button>
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
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Navbar;