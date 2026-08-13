import { Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="px-6 py-24 text-center bg-bg-soft">
        <h1 className="text-5xl font-bold text-text-main leading-tight">
          Shape Your Future at <span className="text-primary">YourCollege</span>
        </h1>
        <p className="text-text-muted mt-6 max-w-xl mx-auto text-lg">
          Quality education, world-class faculty, and a campus built for growth.
          Discover programs designed to launch your career.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            to="/admissions"
            className="bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark transition"
          >
            Apply Now
          </Link>
          <Link
            to="/about"
            className="bg-surface text-text-main px-6 py-3 rounded-soft shadow-soft hover:shadow-soft-lg transition"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Highlights Section */}
      <section className="px-6 py-20 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface rounded-soft-lg shadow-soft p-8 text-center hover:shadow-soft-lg transition">
          <h3 className="text-xl font-bold text-text-main mb-3">50+ Programs</h3>
          <p className="text-text-muted text-sm">
            From engineering to arts, find a program that fits your ambitions.
          </p>
        </div>
        <div className="bg-surface rounded-soft-lg shadow-soft p-8 text-center hover:shadow-soft-lg transition">
          <h3 className="text-xl font-bold text-text-main mb-3">Expert Faculty</h3>
          <p className="text-text-muted text-sm">
            Learn from professors with real-world industry experience.
          </p>
        </div>
        <div className="bg-surface rounded-soft-lg shadow-soft p-8 text-center hover:shadow-soft-lg transition">
          <h3 className="text-xl font-bold text-text-main mb-3">Modern Campus</h3>
          <p className="text-text-muted text-sm">
            Study in facilities built for collaboration and innovation.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-text-main">Ready to get started?</h2>
        <p className="text-text-muted mt-3">Applications for the next intake are open now.</p>
        <Link
          to="/contact"
          className="inline-block mt-6 bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark transition"
        >
          Contact Admissions
        </Link>
      </section>
    </div>
  );
}

export default Home;