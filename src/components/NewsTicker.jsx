import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { api } from "../lib/api";

const defaultNews = [
  "Admissions open for 2026-27 batch — apply now!",
  "MBSCET ranked among top engineering colleges in J&K",
  "Annual Tech Fest 'Innovate' scheduled for March",
  "Placement drive: 15+ companies visiting this semester",
  "NBA accreditation renewed for CSE & ECE departments",
];

// Phase 4: ticker now renders live published news from the API.
// Falls back to the static defaults while loading, on error,
// or when no news has been published yet.
export default function NewsTicker({ items }) {
  const [fetchedTitles, setFetchedTitles] = useState(defaultNews);
  const [paused, setPaused] = useState(false);

  // Explicitly passed-in titles win; otherwise use fetched (or default) ones.
  const titles = items || fetchedTitles;

  useEffect(() => {
    if (items) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/news?limit=8");
        const live = (res?.data || []).map((n) => n.title).filter(Boolean);
        if (!cancelled && live.length > 0) setFetchedTitles(live);
      } catch {
        // API unreachable or empty — keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Duplicate items so the loop feels seamless
  const looped = [...titles, ...titles];

  return (
    <div
      className="w-full flex items-stretch bg-navbar shadow-soft rounded-full overflow-hidden"
      role="region"
      aria-label="Latest news"
    >
      <div className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full shrink-0 z-10 shadow-soft">
        <Megaphone size={16} />
        <span className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
          Latest
        </span>
      </div>

      <div
        className="relative flex-1 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex whitespace-nowrap ticker-track"
          style={{
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {looped.map((item, i) => (
            <span
              key={i}
              aria-hidden={i >= titles.length}
              className="text-sm text-text-main font-medium px-8 py-2.5 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .ticker-track {
          animation: ticker-scroll 30s linear infinite;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
