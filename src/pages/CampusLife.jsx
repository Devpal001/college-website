import { useState } from 'react';
import { Briefcase, Activity, Image, Users2, GraduationCap, Compass, ChevronDown } from 'lucide-react';

const sections = [
  {
    title: 'Training & Placement',
    icon: Briefcase,
    content: 'Our Training and Placement Cell connects students with leading companies through campus drives, internships, and skill-development workshops.',
  },
  {
    title: 'Activities',
    icon: Activity,
    content: 'From technical fests to cultural events, students engage in a wide range of activities throughout the academic year.',
  },
  {
    title: 'Gallery',
    icon: Image,
    content: 'A collection of photos and videos capturing campus life, events, and achievements. (Photo/Video gallery coming soon.)',
  },
  {
    title: 'Institute Clubs',
    icon: Users2,
    content: 'Student-run clubs covering technology, culture, sports, and community service — open to all branches.',
  },
  {
    title: 'Alumni',
    icon: GraduationCap,
    content: 'Our alumni network spans industries worldwide. Alumni registration and success stories help current students connect with graduates.',
  },
  {
    title: 'Campus Virtual Tour',
    icon: Compass,
    content: 'Explore our campus from anywhere with a virtual walkthrough of classrooms, labs, and facilities. (Tour link coming soon.)',
  },
];

function CampusLife() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
        <h1 className="text-4xl font-bold text-text-main">Campus Life</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          Beyond academics — placements, activities, clubs, and community.
        </p>
      </section>

      {/* Accordion Sections */}
      <section className="px-6 py-16 max-w-3xl mx-auto space-y-4">
        {sections.map((sec, index) => {
          const Icon = sec.icon;
          const isOpen = openIndex === index;
          return (
            <div
              key={sec.title}
              className="bg-surface rounded-soft-lg shadow-soft p-6 transition-all duration-200"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-bg-soft shadow-inset flex items-center justify-center shrink-0">
                    <Icon className="text-primary" size={22} />
                  </div>
                  <h3 className="font-bold text-text-main">{sec.title}</h3>
                </div>
                <ChevronDown
                  className={`text-primary transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  size={20}
                />
              </button>

              {isOpen && (
                <p className="text-text-muted text-sm mt-4 pl-16 fade-in">
                  {sec.content}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default CampusLife;