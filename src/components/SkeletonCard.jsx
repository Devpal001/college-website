export default function SkeletonCard() {
  return (
    <div className="bg-surface rounded-soft-lg shadow-soft p-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-soft shadow-inset skeleton"></div>
      <div className="h-6 bg-bg-soft rounded mb-3 mx-auto w-3/4 skeleton"></div>
      <div className="h-4 bg-bg-soft rounded mb-2 mx-auto w-full skeleton"></div>
      <div className="h-4 bg-bg-soft rounded mb-2 mx-auto w-5/6 skeleton"></div>
      <div className="h-4 bg-bg-soft rounded mx-auto w-2/3 skeleton"></div>
    </div>
  );
}