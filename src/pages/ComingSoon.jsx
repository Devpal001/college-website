import { Link } from "react-router-dom";
import { Construction } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <Construction size={48} className="text-secondary mb-4" />
      <h1 className="text-3xl font-bold text-text-main mb-2">
        Page Coming Soon
      </h1>
      <p className="text-text-muted max-w-md mb-6">
        We're still building this page. Check back soon, or head back to the homepage.
      </p>
      <Link
        to="/"
        className="bg-primary text-white px-6 py-3 rounded-soft font-medium hover:bg-primary-dark transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
