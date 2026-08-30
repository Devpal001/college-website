import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <ShieldAlert size={48} className="text-secondary mb-4" />
      <h1 className="text-3xl font-bold text-text-main mb-3">Access Denied</h1>
      <p className="text-text-muted max-w-md">
        You don't have permission to view this page with your current role.
      </p>
      <Link
        to="/"
        className="mt-6 px-6 py-3 rounded-soft bg-primary text-white font-medium hover:bg-primary-dark transition"
      >
        Back to Home
      </Link>
    </div>
  );
}