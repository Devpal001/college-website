import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  getSession, 
  getUserProfile,
  supabase
} from '../lib/auth';

/**
 * Custom hook for authentication state
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const sessionData = await getSession();
        setSession(sessionData);

        if (sessionData?.user) {
          setUser(sessionData.user);
          const profileData = await getUserProfile(sessionData.user.id);
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Error loading auth:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        try {
          const profileData = await getUserProfile(session.user.id);
          setProfile(profileData);
        } catch (error) {
          console.error('Error loading profile:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, profile, loading };
}

/**
 * Protected route component
 */
export function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0 && profile) {
    const hasRequiredRole = requiredRoles.includes(profile.role);
    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}