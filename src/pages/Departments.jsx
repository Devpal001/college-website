import { Cpu, Zap, Radio, Cog, Laptop, Building2, FlaskConical, BrainCircuit } from 'lucide-react';

const departments = [
  { name: 'Computer Science Engineering', icon: Cpu, blurb: 'Software development, AI/ML, and systems design.', intake: 120, duration: '4 Yrs.', level: 'Degree' },
  { name: 'Electrical Engineering', icon: Zap, blurb: 'Power systems, control engineering, and electrical design.', intake: 30, duration: '4 Yrs.', level: 'Degree' },
  { name: 'Electronics & Communication', icon: Radio, blurb: 'Circuit design, communication systems, and embedded tech.', intake: 30, duration: '4 Yrs.', level: 'Degree' },
  { name: 'Mechanical Engineering', icon: Cog, blurb: 'Design, manufacturing, and thermal systems.', intake: 30, duration: '4 Yrs.', level: 'Degree' },
  { name: 'Information Technology', icon: Laptop, blurb: 'Networks, databases, and application development.', intake: 60, duration: '4 Yrs.', level: 'Degree' },
  { name: 'Civil Engineering', icon: Building2, blurb: 'Structural design, construction, and infrastructure.', intake: 60, duration: '4 Yrs.', level: 'Degree' },
  { name: 'CSE (AI & ML)', icon: BrainCircuit, blurb: 'Artificial intelligence, machine learning, and data-driven systems.', intake: 60, duration: '4 Yrs.', level: 'Degree', note: 'Subject to Approval' },
  { name: 'Applied Science & Humanities', icon: FlaskConical, blurb: 'Foundational sciences and communication skills for all branches.' },
];

function Departments() {
  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
        <h1 className="text-4xl font-bold text-text-main">Departments</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          Seven departments, one mission — preparing engineers for a changing world.
        </p>
      </section>

      {/* Approval banner */}
      <section className="px-6 max-w-3xl mx-auto -mt-4 mb-4">
        <div className="bg-surface rounded-soft-lg shadow-soft p-5 text-center text-sm text-text-muted">
          Approved by the <span className="text-text-main font-medium">All India Council for Technical Education (AICTE)</span>, Govt. of India, New Delhi, for admission across six engineering disciplines — a combined intake of <span className="text-text-main font-medium">330 students</span>.
        </div>
      </section>

      {/* Card Grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => {
          const Icon = dept.icon;
          return (
            <div
              key={dept.name}
              className="group relative bg-surface shadow-soft hover:shadow-soft-lg rounded-soft-lg overflow-hidden transition-all duration-500 ease-out min-h-55"
            >
              {/* Diagonal wedge panel */}
              <div className="dept-wedge absolute bg-primary" />

              {/* Content sits above the panel */}
              <div className="relative z-10 p-6 h-full flex flex-col">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-bg-soft shadow-inset flex items-center justify-center shrink-0 group-hover:bg-white transition-colors duration-500">
                    <Icon className="text-primary transition-colors duration-500" size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main group-hover:text-white leading-tight transition-colors duration-500">
                      {dept.name}
                    </h3>
                    {dept.note && (
                      <span className="inline-block text-xs bg-primary/10 text-primary group-hover:bg-white/20 group-hover:text-white px-2 py-0.5 rounded-full mt-1 transition-colors duration-500">
                        {dept.note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hidden until hover — reveals with the wedge */}
                <div className="dept-details opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150">
                  <p className="text-white/90 text-sm mt-4">
                    {dept.blurb}
                  </p>

                  {dept.intake && (
                    <div className="flex gap-4 text-sm text-white/80 mt-auto pt-4 border-t border-white/20">
                      <span>Intake: <span className="font-medium">{dept.intake}</span></span>
                      <span>{dept.level} · {dept.duration}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* M.Tech note */}
      <section className="px-6 pb-16 max-w-3xl mx-auto text-center">
        <p className="text-text-muted text-sm">
          M.Tech programs in CSE, EE, ME, and ECE are AICTE-approved; final approval from the J&K Government and University of Jammu is in process.
        </p>
      </section>
    </div>
  );
}

export default Departments;