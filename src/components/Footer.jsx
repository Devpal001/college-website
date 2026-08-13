function Footer() {
  return (
    <footer className="w-full bg-surface shadow-soft mt-16 px-6 py-10 rounded-t-soft-lg text-text-muted">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">
            Your<span className="text-blue-600">College</span>
          </h3>
          <p className="text-sm">
            Shaping futures through quality education, research, and innovation.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-gray-800 mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li className="hover:text-blue-600 cursor-pointer transition">Home</li>
            <li className="hover:text-blue-600 cursor-pointer transition">About</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Admissions</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Contact</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-gray-800 mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>123 College Road, Your City</li>
            <li>info@yourcollege.edu</li>
            <li>+91 98765 43210</li>
          </ul>
        </div>

      </div>

      <div className="text-center text-xs text-gray-400 mt-8">
        © {new Date().getFullYear()} YourCollege. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;