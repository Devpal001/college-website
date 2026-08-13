import { Link } from 'react-router-dom';
function Navbar() {
  return (
    <nav className="w-full bg-surface shadow-soft px-6 py-4 flex items-center justify-between rounded-b-soft-lg">
      <div className="text-xl font-bold text-gray-800">
        Your<span className="text-blue-600">College</span>
      </div>

      <ul className="hidden md:flex gap-8 text-gray-600 font-medium">
  <li className="hover:text-blue-600 transition">
    <Link to="/">Home</Link>
  </li>
  <li className="hover:text-blue-600 transition">
    <Link to="/about">About</Link>
  </li>
  <li className="hover:text-blue-600 transition">
    <Link to="/admissions">Admissions</Link>
  </li>
  <li className="hover:text-blue-600 transition">
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