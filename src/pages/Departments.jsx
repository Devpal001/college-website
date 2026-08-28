import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { departments } from '../data/departments';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import SkeletonCard from '../components/SkeletonCard';
import LoadingSpinner from '../components/LoadingSpinner';

function Departments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [headerRef, headerVisible] = useScrollAnimation({ once: true });
  const [cardsRef, cardsVisible] = useScrollAnimation({ once: true });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for demonstration
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.blurb.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <section ref={headerRef} className={`container-lg py-32 text-center bg-bg-soft scroll-animate ${headerVisible ? 'is-visible' : ''}`}>
        <h1 className="text-4xl md:text-5xl font-bold text-text-main">Departments</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto text-lg">
          Eight departments, one mission — preparing engineers for a changing world.
        </p>
      </section>

      {/* Search Bar */}
      <section className="container-lg max-w-2xl mx-auto -mt-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-3 bg-surface border border-text-muted/20 rounded-soft-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main placeholder-text-muted transition-all disabled:opacity-50"
            aria-label="Search departments"
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
      </section>

      {/* Approval banner */}
      <section className="container-lg max-w-3xl mx-auto mb-4">
        <div className="bg-surface rounded-soft-lg shadow-soft p-5 text-center text-sm text-text-muted">
          Approved by the <span className="text-text-main font-medium">All India Council for Technical Education (AICTE)</span>, Govt. of India, New Delhi, for admission across six engineering disciplines — a combined intake of <span className="text-text-main font-medium">330 students</span>.
        </div>
      </section>

      {/* Card Grid */}
      <section ref={cardsRef} className="container-lg py-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          // Show skeleton cards while loading
          Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))
        ) : filteredDepartments.length > 0 ? (
          filteredDepartments.map((dept, index) => {
            const Icon = dept.icon;
            const staggerClass = `stagger-${(index % 6) + 1}`;
            return (
              <Link
                key={dept.id}
                to={dept.path}
                className={`group relative card-base card-interactive dept-card-enhanced overflow-hidden min-h-55 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-soft-lg scroll-animate ${staggerClass} ${cardsVisible ? 'is-visible' : ''}`}
              >
                {/* Diagonal wedge panel */}
                <div className="dept-wedge absolute bg-primary" />
                {/* Hover bubble effect */}
                <div className="hover-bubble" />

                {/* Content sits above the panel */}
                <div className="relative z-10 p-8 h-full flex flex-col">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-bg-soft shadow-inset flex items-center justify-center shrink-0 group-hover:bg-white transition-colors duration-500">
                      <Icon className="text-primary transition-colors duration-500" size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main group-hover:text-white leading-tight transition-colors duration-500">
                        {dept.name}
                      </h3>
                      {dept.note && (
                        <span className="inline-block text-xs badge badge-warning px-2 py-0.5 rounded-full mt-1 transition-colors duration-500">
                          {dept.note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hidden until hover — reveals with the wedge */}
                  <div className="dept-details opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
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
              </Link>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-text-muted">
            <p>No departments found matching "{searchTerm}"</p>
          </div>
        )}
        </div>
      </section>

      {/* M.Tech note */}
      <section className="container-lg pb-16 max-w-3xl mx-auto text-center">
        <p className="text-text-muted text-sm">
          M.Tech programs in CSE, EE, ME, and ECE are AICTE-approved; final approval from the J&K Government and University of Jammu is in process.
        </p>
        <p className="text-text-muted text-xs mt-2">
          Click on any department card to learn more about that specific branch.
        </p>
      </section>
    </div>
  );
}

export default Departments;