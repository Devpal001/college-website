import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
  };

  return (
    <section className="px-6 py-24 text-center bg-bg-soft min-h-[70vh] flex flex-col items-center justify-center fade-in">
      <div className="bg-surface rounded-soft-lg shadow-soft p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-text-main mb-6">Welcome Back</h1>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label htmlFor="login-email" className="text-sm text-text-muted block mb-1">
              Email
            </label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className="text-sm text-text-muted block mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-sm text-text-muted mt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </section>
  );
}

export default Login;