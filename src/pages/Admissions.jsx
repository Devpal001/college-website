import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Admissions() {
  const [showEligibility, setShowEligibility] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    course_applied: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { error } = await supabase.from('admissions').insert([form]);

    setSubmitting(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setForm({ full_name: '', email: '', phone: '', course_applied: '', message: '' });
    }
  };

  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
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
            <p className="text-text-muted text-sm leading-relaxed">Browse our 50+ programs and pick the one that fits you.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">2</div>
            <h4 className="font-semibold text-text-main mb-2">Submit Application</h4>
            <p className="text-text-muted text-sm leading-relaxed">Fill out the online form with your academic details.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">3</div>
            <h4 className="font-semibold text-text-main mb-2">Entrance Review</h4>
            <p className="text-text-muted text-sm leading-relaxed">Our team reviews your application and test scores.</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 text-center">
            <div className="text-primary text-2xl font-bold mb-2">4</div>
            <h4 className="font-semibold text-text-main mb-2">Get Admitted</h4>
            <p className="text-text-muted text-sm">Receive your offer letter and confirm your seat.</p>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="px-6 py-16 bg-bg-soft">
        <div className="max-w-2xl mx-auto bg-surface rounded-soft-lg shadow-soft p-8">
          <h2 className="text-2xl font-bold text-text-main mb-6 text-center">Apply Now</h2>

          {success ? (
            <p className="text-success-dark text-center font-medium">
              Application submitted! We'll be in touch soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="text-sm text-text-muted block mb-1">Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={form.full_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                />
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                />
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                />
              </div>
                            <div>
                <label className="text-sm text-text-muted block mb-1">Course Applying For</label>
                <select
                  name="course_applied"
                  required
                  value={form.course_applied}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                >
                  <option value="" disabled>Select a B.Tech branch</option>
                  <option value="B.Tech Computer Science Engineering">B.Tech Computer Science Engineering</option>
                  <option value="B.Tech Information Technology">B.Tech Information Technology</option>
                  <option value="B.Tech Mechanical Engineering">B.Tech Mechanical Engineering</option>
                  <option value="B.Tech Civil Engineering">B.Tech Civil Engineering</option>
                  <option value="B.Tech Electrical Engineering">B.Tech Electrical Engineering</option>
                  <option value="B.Tech Electronics & Communication Engineering">B.Tech Electronics & Communication Engineering</option>
                </select>
                <label className="text-sm text-text-muted block mb-1">Message (optional)</label>
                <textarea
                  name="message"
                  rows={3}
                  value={form.message}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
                />
              </div>

              {error && <p className="text-error text-sm">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition w-full"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Eligibility - Accordion */}
      <section className="px-6 py-16 bg-bg-soft">
        <div className="max-w-3xl mx-auto bg-surface rounded-soft-lg shadow-soft p-8">
          <button
            onClick={() => setShowEligibility(!showEligibility)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-xl font-bold text-text-main">Eligibility Requirements</h3>
            <ChevronDown
              className={`text-primary transition-transform duration-300 ${showEligibility ? 'rotate-180' : ''}`}
              size={22}
            />
          </button>

          {showEligibility && (
            <ul className="text-text-muted text-sm space-y-2 list-disc list-inside mt-4 fade-in">
              <li>Completed higher secondary education (Grade 12 or equivalent)</li>
              <li>Minimum aggregate score as per program requirements</li>
              <li>Valid entrance exam scores (where applicable)</li>
              <li>Statement of purpose and academic transcripts</li>
            </ul>
          )}
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