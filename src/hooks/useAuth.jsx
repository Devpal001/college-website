import { useState, useEffect } from 'react';
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