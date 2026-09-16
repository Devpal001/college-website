import { useEffect, useSyncExternalStore } from 'react';
import {
  getSessionState,
  startSessionTracking,
  subscribeSession,
} from '../lib/sessionStore';

/**
 * Authentication state for the current browser session.
 *
 * Delegates to lib/sessionStore: ONE shared Supabase auth subscription and
 * ONE server-side role resolution (`GET /api/auth/me`) for the whole app,
 * instead of every component re-querying the database on its own.
 *
 * @returns {{ session: object|null, user: object|null, profile: object|null, loading: boolean }}
 */
export function useAuth() {
  useEffect(() => {
    startSessionTracking();
  }, []);

  return useSyncExternalStore(subscribeSession, getSessionState);
}

export default useAuth;