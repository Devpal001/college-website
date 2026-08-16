import { useState } from 'react';
import { Cpu, Zap, Radio, Cog, Laptop, Building2, FlaskConical, ChevronDown } from 'lucide-react';

const departments = [
  {
    name: 'Computer Science Engineering',
    icon: Cpu,
    blurb: 'Software development, AI/ML, and systems design.',
  },
  {
    name: 'Electrical Engineering',
    icon: Zap,
    blurb: 'Power systems, control engineering, and electrical design.',
  },
  {
    name: 'Electronics & Communication',
    icon: Radio,
    blurb: 'Circuit design, communication systems, and embedded tech.',
  },
  {
    name: 'Mechanical Engineering',
    icon: Cog,
    blurb: 'Design, manufacturing, and thermal systems.',
  },
  {
    name: 'Information Technology',
    icon: Laptop,
    blurb: 'Networks, databases, and application development.',
  },
  {
    name: 'Civil Engineering',
    icon: Building2,
    blurb: 'Structural design, construction, and infrastructure.',
  },
  {
    name: 'Applied Science & Humanities',
    icon: FlaskConical,
    blurb: 'Foundational sciences and communication skills for all branches.',
  },
];

function Departments() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
        <h1 className="text-4xl font-bold text-text-main">Departments</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          Seven departments, one mission — preparing engineers for a changing world.
        </p>
      </section>

      {/* Card Grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {departments.map((dept, index) => {
          const Icon = dept.icon;
          const isOpen = openIndex === index;
          return (
            <div
              key={dept.name}
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
                  <h3 className="font-bold text-text-main">{dept.name}</h3>
                </div>
                <ChevronDown
                  className={`text-primary transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  size={20}
                />
              </button>

              {isOpen && (
                <p className="text-text-muted text-sm mt-4 pl-16 fade-in">
                  {dept.blurb}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default Departments;