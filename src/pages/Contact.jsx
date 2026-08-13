function Contact() {
  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft">
        <h1 className="text-4xl font-bold text-text-main">Contact Us</h1>
        <p className="text-text-muted mt-4 max-w-2xl mx-auto">
          Have a question? Reach out and our team will get back to you.
        </p>
      </section>

      {/* Form + Info */}
      <section className="px-6 py-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Form */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-8">
          <h3 className="text-xl font-bold text-text-main mb-6">Send a Message</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-muted block mb-1">Name</label>
              <input
                type="text"
                placeholder="Your full name"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft border border-transparent focus:border-primary outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft border border-transparent focus:border-primary outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1">Message</label>
              <textarea
                rows="4"
                placeholder="How can we help?"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft border border-transparent focus:border-primary outline-none transition"
              ></textarea>
            </div>
            <button
              type="button"
              className="bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark transition w-full"
            >
              Send Message
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <h4 className="font-semibold text-text-main mb-1">Address</h4>
            <p className="text-text-muted text-sm">123 College Road, Your City, 400001</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <h4 className="font-semibold text-text-main mb-1">Email</h4>
            <p className="text-text-muted text-sm">info@yourcollege.edu</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <h4 className="font-semibold text-text-main mb-1">Phone</h4>
            <p className="text-text-muted text-sm">+91 98765 43210</p>
          </div>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <h4 className="font-semibold text-text-main mb-1">Office Hours</h4>
            <p className="text-text-muted text-sm">Mon–Fri, 9:00 AM – 5:00 PM</p>
          </div>
        </div>

      </section>
    </div>
  );
}

export default Contact;