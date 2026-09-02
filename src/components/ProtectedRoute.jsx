import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

/**
 * Protected route component
 */
export default function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0) {
    // Defense-in-depth: if the profile could not be loaded (or the user has no
    // profile row), we cannot verify the role — deny the UI route. The server
    // still enforces real authorization; this closes the client-side role gate
    // when profile is null.
    if (!profile) return <Navigate to="/unauthorized" replace />;
    if (!requiredRoles.includes(profile.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}