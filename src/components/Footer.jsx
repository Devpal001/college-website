function Footer() {
  return (
    <footer className="w-full bg-surface shadow-soft mt-16 px-6 py-10 rounded-t-soft-lg text-text-muted">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div>
          <h3 className="text-lg font-bold text-text-main mb-3">
            MBSCET <span className="text-primary">Jammu</span>
          </h3>
          <p className="text-sm">
            Mahant Bachittar Singh College of Engineering & Technology — 
            established 1999, Jammu.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-text-main mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li className="hover:text-primary cursor-pointer transition">Home</li>
            <li className="hover:text-primary cursor-pointer transition">About</li>
            <li className="hover:text-primary cursor-pointer transition">Admissions</li>
            <li className="hover:text-primary cursor-pointer transition">Contact</li>
          </ul>
        </div>

        <div>
            <h4 className="font-semibold text-text-main mb-3">Contact</h4>
            <ul className="space-y-2 text-sm">
                <li>Babliana, Jeevan Nagar Road, P.O. Miran Sahib, Jammu – 181101</li>
                <li>principal@mbscet.edu.in</li>
                <li>0191-2970136</li>
            </ul>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mt-8">
        © {new Date().getFullYear()} MBSCET Jammu. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;