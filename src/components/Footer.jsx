import { Link } from 'react-router-dom';

const linkGroups = [
  {
    title: "Academics",
    links: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Course & Admission", href: "/admissions" },
      { label: "Departments", href: "/departments" },
      { label: "Training and Placement", href: "/placement" },
      { label: "Activities", href: "/activities" },
    ],
  },
  {
    title: "Branches",
    links: [
      { label: "Common To All Branch", href: "/departments/common" },
      { label: "CSE Branch", href: "/departments/cse" },
      { label: "IT Branch", href: "/departments/it" },
      { label: "Mechanical Branch", href: "/departments/mechanical" },
      { label: "ECE Branch", href: "/departments/ece" },
      { label: "EE Branch", href: "/departments/ee" },
      { label: "Civil Engineering", href: "/departments/civil" },
    ],
  },
  {
    title: "Grievances & Compliance",
    links: [
      {
        label: "Faculty/Student Caste (SC/ST/OBC) Complaints",
        href: "/grievances/caste-discrimination",
      },
      { label: "Grievances Redressal Cell", href: "/grievances" },
      { label: "Anti Ragging", href: "/anti-ragging" },
      { label: "NBA", href: "/nba" },
      { label: "AICTE Feedback", href: "/aicte-feedback" },
    ],
  },
  {
    title: "More",
    links: [
      { label: "Photo Gallery", href: "/gallery/photos" },
      { label: "Video Gallery", href: "/gallery/videos" },
      { label: "Messages", href: "/messages" },
      { label: "Important Links", href: "/important-links" },
      { label: "Alumni Registration", href: "/alumni" },
      { label: "Campus Virtual Tour", href: "/virtual-tour" },
      { label: "Press Release", href: "/press" },
      { label: "Institute Clubs", href: "/clubs" },
    ],
  },
];

function Footer() {
  return (
    <footer className="w-full bg-surface shadow-soft mt-16 rounded-t-soft-lg text-text-muted">
      {/* Link groups */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-8 grid grid-cols-2 md:grid-cols-4 gap-8 border-b border-text-muted/15">
        {linkGroups.map((group) => (
          <div key={group.title}>
            <h4 className="font-semibold text-text-main text-sm uppercase tracking-wide mb-3">
              {group.title}
            </h4>
            <ul className="space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Brand + contact */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-lg font-bold text-text-main mb-3">
            MBSCET <span className="text-primary">Jammu</span>
          </h3>
          <p className="text-sm">
            Mahant Bachittar Singh College of Engineering & Technology —
            established 1999, Jammu.
          </p>
        </div>

        <div className="md:col-start-3">
          <h4 className="font-semibold text-text-main mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>Babliana, Jeevan Nagar Road, P.O. Miran Sahib, Jammu – 181101</li>
            <li>principal@mbscet.edu.in</li>
            <li>0191-2970136</li>
          </ul>
        </div>
      </div>

      <div className="text-center text-xs text-text-muted pb-6">
        © {new Date().getFullYear()} MBSCET Jammu. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;