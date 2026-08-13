import { Link } from 'react-router-dom';

function Admissions() {
  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft">
        <h1 className="text-4xl font-bold text-text-main">Admissions</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          Start your journey with us. Here's everything you need to know to apply.
        </p>
      </section>

      {/* Steps */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-text-main text-center mb-10">
          How to Apply
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">1</div>
            <h4 className="font-semibold text-text-main mb-2">Choose a Program</h4>
            <p className="text-text-muted text-sm">Browse our 50+ programs and pick the one that fits you.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">2</div>
            <h4 className="font-semibold text-text-main mb-2">Submit Application</h4>
            <p className="text-text-muted text-sm">Fill out the online form with your academic details.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">3</div>
            <h4 className="font-semibold text-text-main mb-2">Entrance Review</h4>
            <p className="text-text-muted text-sm">Our team reviews your application and test scores.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">4</div>
            <h4 className="font-semibold text-text-main mb-2">Get Admitted</h4>
            <p className="text-text-muted text-sm">Receive your offer letter and confirm your seat.</p>
          </div>
        </div>
      </section>

      {/* Eligibility */}
      <section className="px-6 py-16 bg-bg-soft">
        <div className="max-w-3xl mx-auto bg-surface rounded-soft-lg shadow-soft p-8">
          <h3 className="text-xl font-bold text-text-main mb-4">Eligibility Requirements</h3>
          <ul className="text-text-muted text-sm space-y-2 list-disc list-inside">
            <li>Completed higher secondary education (Grade 12 or equivalent)</li>
            <li>Minimum aggregate score as per program requirements</li>
            <li>Valid entrance exam scores (where applicable)</li>
            <li>Statement of purpose and academic transcripts</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-text-main">Have questions?</h2>
        <p className="text-text-muted mt-3">Our admissions team is here to help.</p>
        <Link
          to="/contact"
          className="inline-block mt-6 bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark transition"
        >
          Contact Us
        </Link>
      </section>
    </div>
  );
}

export default Admissions;