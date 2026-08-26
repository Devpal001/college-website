import { Link } from "react-router-dom";
import { Construction } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <Construction size={48} className="text-indigo-500 mb-4" />
      <h1 className="text-3xl font-bold text-slate-800 mb-2">
        Page Coming Soon
      </h1>
      <p className="text-slate-500 max-w-md mb-6">
        We're still building this page. Check back soon, or head back to the homepage.
      </p>
      <Link
        to="/"
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
