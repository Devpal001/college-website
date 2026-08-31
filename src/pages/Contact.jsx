import { useState } from 'react';
import { supabase } from '../lib/supabase';

function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    const { error } = await supabase
      .from('messages')
      .insert([{ name, email, message }]);

    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    }
  };

  return (
    <div>
      {/* ...your Header section stays unchanged... */}

      <section className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Form */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-8">
          <h3 className="text-xl font-bold text-text-main mb-6">Send a Message</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="contact-name" className="text-sm text-text-muted block mb-1">Name</label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="text-sm text-text-muted block mb-1">Email</label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="text-sm text-text-muted block mb-1">Message</label>
              <textarea
                id="contact-message"
                required
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
              ></textarea>
            </div>

            {status === 'success' && (
              <p role="status" className="text-success-dark text-sm">Message sent! We'll get back to you soon.</p>
            )}
            {status === 'error' && (
              <p role="alert" className="text-error text-sm">Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark transition w-full"
            >
              {status === 'sending' ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        {/* ...your Info column stays unchanged... */}

      </section>
    </div>
  );
}

export default Contact;