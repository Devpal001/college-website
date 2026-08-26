export default function PlaceholderPage({ title, description }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-24">
      <h1 className="text-3xl font-bold text-text-main mb-3">{title}</h1>
      <p className="text-text-muted max-w-md">
        {description || "This page is under construction. Content will be added soon."}
      </p>
    </div>
  );
}