function Contact() {
  return (
    <div>
      {/* Header */}
      <section className="px-6 py-20 text-center bg-bg-soft fade-in">
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
                className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,58,95,0.15)] outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,58,95,0.15)] outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1">Message</label>
              <textarea
                rows="4"
                placeholder="How can we help?"
               className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary focus:shadow-[0_0_0_3px_rgba(30,58,95,0.15)] outline-none transition"
              ></textarea>
            </div>
            <button
              type="button"
              className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition"
            >
              Send Message
            </button>
          </div>
        </div>

        {/* Info */}
       <div className="bg-surface rounded-soft-lg shadow-soft p-6">
        <h4 className="font-semibold text-text-main mb-1">Address</h4>
        <p className="text-text-muted text-sm">Babliana, Jeevan Nagar Road, P.O. Miran Sahib, Jammu – 181101</p>
        </div>
        <div className="bg-surface rounded-soft-lg shadow-soft p-6">
            <h4 className="font-semibold text-text-main mb-1">Principal's Office</h4>
            <p className="text-text-muted text-sm">principal@mbscet.edu.in · 0191-2970136</p>
            </div>
            <div className="bg-surface rounded-soft-lg shadow-soft p-6">
                <h4 className="font-semibold text-text-main mb-1">Dean Academics</h4>
                <p className="text-text-muted text-sm">dean.academics@mbscet.edu.in · +91 9419288486</p>
                </div>
      </section>
    </div>
  );
}

export default Contact;