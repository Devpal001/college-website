import { Link } from 'react-router-dom';
import logo from '../assets/mbslogo.png';

function Navbar() {
  return (
<nav className="w-full bg-surface shadow-soft px-6 py-7 flex items-center justify-between rounded-b-soft-lg">
      <div className="flex items-center gap-3">
        <img src={logo} alt="MBSCET Jammu Logo" className="h-30 w-30 object-contain shrink-0" />
      </div>

      <ul className="hidden md:flex gap-8 text-gray-600 font-medium">
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

      <button className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark transition">
        Apply Now
      </button>
    </nav>
  );
}

export default Navbar;