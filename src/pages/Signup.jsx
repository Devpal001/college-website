import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic client-side validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      // Provide more specific error messages
      if (error.message.includes('already registered')) {
        setError('An account with this email already exists. Please log in instead.');
      } else if (error.message.includes('Password')) {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError('Unable to create account. Please try again later.');
      }
    } else {
      navigate('/login');
    }
  };

  return (
    <section className="px-6 py-24 text-center bg-bg-soft min-h-[70vh] flex flex-col items-center justify-center fade-in">
      <div className="bg-surface rounded-soft-lg shadow-soft p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-text-main mb-6">Create an Account</h1>

        <form onSubmit={handleSignup} className="space-y-4 text-left">
          <div>
            <label htmlFor="signup-email" className="text-sm text-text-muted block mb-1">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="text-sm text-text-muted block mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition"
            />
          </div>

          {error && (
            <div role="alert" className="bg-error/10 border border-error/20 rounded-soft p-3">
              <p className="text-error text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-6 py-3 rounded-soft shadow-soft w-full"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-sm text-text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}

export default Signup;