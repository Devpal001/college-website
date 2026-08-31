import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import campus1 from '../assets/campus/college_auditorium.jpg';
import campus2 from '../assets/campus/library_2nd_floor.jpg';
import campus3 from '../assets/campus/computer_science_advance_lab.jpg';
import campus4 from '../assets/campus/mechanical_lab1.jpg';
import campus5 from '../assets/campus/college_playground.jpg';

const images = [
  { src: campus1, caption: 'College Auditorium' },
  { src: campus2, caption: 'Library' },
  { src: campus3, caption: 'Computer Science Lab' },
  { src: campus4, caption: 'Mechanical Lab' },
  { src: campus5, caption: 'Campus Playground' },
];

function PhotoCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Autoplay respects prefers-reduced-motion (design system §21):
  // users who opt out of motion get manual-only navigation.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 4500); // slides every 4.5 seconds
    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion]);

  const goPrev = () => setCurrent((prev) => (prev - 1 + images.length) % images.length);
  const goNext = () => setCurrent((prev) => (prev + 1) % images.length);

  return (
    <section className="px-6 py-16 bg-bg-soft">
      <h2 className="text-2xl font-bold text-text-main text-center mb-3">Campus Life</h2>
      <p className="text-text-muted text-center max-w-xl mx-auto mb-8">
        A glimpse into our labs, libraries, and campus facilities
      </p>

      <div
        className="relative max-w-4xl mx-auto rounded-soft-lg shadow-soft-lg overflow-hidden ring-1 ring-black/5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative h-90">
          {images.map((img, index) => (
            <div
              key={index}
              aria-hidden={index !== current}
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <img src={img.src} alt={img.caption} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent text-white text-sm px-5 py-4">
                {img.caption}
              </div>
            </div>
          ))}
        </div>

        {/* Prev/Next buttons */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-soft transition"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-soft transition"
        >
          <ChevronRight size={20} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 right-4 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Go to photo ${index + 1}`}
              aria-current={index === current}
              className={`w-2 h-2 rounded-full transition ${
                index === current ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default PhotoCarousel;