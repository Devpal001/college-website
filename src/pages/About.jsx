import { Calendar, Users, BookOpen, GraduationCap } from 'lucide-react';

function About() {
  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
        <h1 className="text-4xl font-bold text-text-main">About YourCollege</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          For decades, we've been committed to academic excellence, innovation,
          and preparing students to lead in a changing world.
        </p>
      </section>
      {/* Jump-to nav */}
      <div className="flex justify-center gap-6 py-4 bg-surface shadow-soft mx-6 md:mx-auto md:max-w-md rounded-full -mt-6 relative z-10">
        <a href="#mission-vision" className="text-sm font-medium text-text-muted hover:text-primary transition">
          Mission & Vision
          </a>
          <a href="#stats" className="text-sm font-medium text-text-muted hover:text-primary transition">
            Stats
            </a>
            <a href="#story" className="text-sm font-medium text-text-muted hover:text-primary transition">
              Our Story
              </a>
        </div>
      {/* Mission & Vision */}
      <section id="mission-vision" className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8"></section>
      <section className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface rounded-soft-lg shadow-soft p-8">
          <h3 className="text-xl font-bold text-text-main mb-3">Our Mission</h3>
          <p className="text-text-muted text-sm">
            To provide accessible, high-quality education that empowers students
            to achieve their full potential and make a meaningful impact on society.
          </p>
        </div>
        <div className="bg-surface rounded-soft-lg shadow-soft p-8">
          <h3 className="text-xl font-bold text-text-main mb-3">Our Vision</h3>
          <p className="text-text-muted text-sm">
             Welcome to Mahant Bachitttar Singh College of Engineering and Technology,
             a spirituo-educational community inspired by Mahant Bachittar Singh Ji,
             with an eye to provide learners with excellent erudition.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="px-6 py-16 bg-bg-soft"></section>
      <section className="px-6 py-16 bg-bg-soft">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <Calendar className="text-primary mx-auto mb-2" size={24} />
            <h3 className="text-3xl font-bold text-primary">25+</h3>
            <p className="text-text-muted text-sm mt-2">Years of Excellence</p>
          </div>
          <div>
            <Users className="text-primary mx-auto mb-2" size={24} />
            <h3 className="text-3xl font-bold text-primary">10,000+</h3>
            <p className="text-text-muted text-sm mt-2">Alumni Worldwide</p>
          </div>
          <div>
            <BookOpen className="text-primary mx-auto mb-2" size={24} />
            <h3 className="text-3xl font-bold text-primary">50+</h3>
            <p className="text-text-muted text-sm mt-2">Academic Programs</p>
          </div>
          <div>
            <GraduationCap className="text-primary mx-auto mb-2" size={24} />
            <h3 className="text-3xl font-bold text-primary">200+</h3>
            <p className="text-text-muted text-sm mt-2">Faculty Members</p>
          </div>
        </div>
      </section>

      {/* History */}
      <section id="story" className="px-6 py-16 max-w-3xl mx-auto text-center"></section>
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-text-main mb-4">Our Story</h2>
        <p className="text-text-muted text-sm leading-relaxed">
          Founded with a vision to make quality education accessible, YourCollege
          has grown from a small institution into a thriving academic community.
          Today, we continue to evolve — embracing technology, research, and
          real-world learning to prepare our students for tomorrow's challenges.
        </p>
      </section>
    </div>
  );
}

export default About;