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

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
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
            <p role="alert" className="text-error text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-3 rounded-soft shadow-soft hover:bg-primary-dark active:scale-95 active:shadow-inset transition w-full"
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