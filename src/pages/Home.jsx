import { Link } from 'react-router-dom';
import { GraduationCap, Users, Building2 } from 'lucide-react';
import campusImg from '../assets/admin_library-1.jpg';
import PhotoCarousel from '../components/PhotoCarousel';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
function Home() {
  const [highlightsRef, highlightsVisible] = useScrollAnimation({ once: true });
  const [ctaRef, ctaVisible] = useScrollAnimation({ once: true });

  return (
    <div>
      {/* Hero Section */}
<section
  className="relative container-lg py-32 text-center overflow-hidden fade-in"
  style={{
    backgroundImage: `url(${campusImg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}>
  {/* Semi-transparent overlay */}
  <div className="absolute inset-0 bg-bg-soft opacity-70"></div>

  {/* Content sits above the overlay */}
  <div className="relative z-10">
    <h1 className="text-5xl md:text-6xl font-bold text-text-main leading-tight">
      Shape Your Future at <span className="text-primary">MBSCET</span>
    </h1>
    <p className="text-text-muted mt-6 max-w-xl mx-auto text-lg md:text-xl">
      A spirituo-educational community inspired by Mahant Bachittar Singh Ji,
      committed to providing learners with excellent erudition.
    </p>
    <p className="text-xs md:text-sm text-text-muted mt-4 font-normal tracking-wide">
    A Constituent of Sant Manjit Singh Trust · Approved by AICTE New Delhi · Govt. of J&K · Affiliated to University of Jammu
    </p>
    <div className="mt-8 flex gap-4 justify-center">
      <Link
        to="/admissions"
        className="btn-primary px-6 py-3 rounded-soft shadow-soft"
      >
        Apply Now
      </Link>
      <Link
        to="/about"
        className="btn-secondary px-6 py-3 rounded-soft shadow-soft"
      >
        Learn More
      </Link>
    </div>
  </div>
</section>
<PhotoCarousel />
      {/* Highlights Section */}
      <section ref={highlightsRef} className="container-lg py-32 text-center bg-bg-soft">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={`card-base card-hover p-8 text-center scroll-animate stagger-1 ${highlightsVisible ? 'is-visible' : ''}`}>
  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-soft shadow-inset flex items-center justify-center">
    <GraduationCap className="text-primary" size={28} />
  </div>
  <h3 className="text-xl font-bold text-text-main mb-3 tracking-tight">50+ Programs</h3>
<p className="text-text-muted text-base leading-relaxed">
  From engineering to arts, find a program that fits your ambitions.
</p>
</div>

<div className={`card-base card-hover p-8 text-center scroll-animate stagger-2 ${highlightsVisible ? 'is-visible' : ''}`}>
  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-soft shadow-inset flex items-center justify-center">
    <Users className="text-primary" size={28} />
  </div>
  <h3 className="text-xl font-bold text-text-main mb-3">Expert Faculty</h3>
  <p className="text-text-muted text-base">
    Learn from professors with real-world industry experience.
  </p>
</div>

<div className={`card-base card-hover p-8 text-center scroll-animate stagger-3 ${highlightsVisible ? 'is-visible' : ''}`}>
  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-soft shadow-inset flex items-center justify-center">
    <Building2 className="text-primary" size={28} />
  </div>
  <h3 className="text-xl font-bold text-text-main mb-3">Modern Campus</h3>
  <p className="text-text-muted text-base">
    Study in facilities built for collaboration and innovation.
  </p>
</div>
        </div>
      </section>

      {/* CTA Section */}
     <section ref={ctaRef} className={`container-lg py-32 text-center bg-bg-soft scroll-animate ${ctaVisible ? 'is-visible' : ''}`}>
        <h2 className="text-3xl md:text-4xl font-bold text-text-main">Ready to get started?</h2>
        <p className="text-text-muted mt-3 text-lg">Applications for the next intake are open now.</p>
        <Link
          to="/contact"
          className="btn-primary inline-block mt-6 px-8 py-4 rounded-soft shadow-soft"
        >
          Contact Admissions
        </Link>
      </section>
    </div>
  );
}

export default Home;