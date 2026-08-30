import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Newspaper, Search, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const CATEGORIES = [
  'all',
  'exam',
  'admission',
  'result',
  'event',
  'placement',
  'scholarship',
  'holiday',
  'deadline',
  'academic',
  'administrative',
  'general',
  'urgent',
];

const CATEGORY_STYLES = {
  urgent: 'bg-red-100 text-red-700',
  exam: 'bg-amber-100 text-amber-700',
  admission: 'bg-blue-100 text-blue-700',
  placement: 'bg-emerald-100 text-emerald-700',
  result: 'bg-violet-100 text-violet-700',
  event: 'bg-pink-100 text-pink-700',
  scholarship: 'bg-teal-100 text-teal-700',
  holiday: 'bg-orange-100 text-orange-700',
};

function categoryBadgeClass(category) {
  return CATEGORY_STYLES[category] || 'bg-gray-100 text-gray-600';
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function excerpt(text, max = 180) {
  if (!text) return '';

  return text.length > max
    ? `${text.slice(0, max).trimEnd()}…`
    : text;
}

function NewsCard({ item }) {
  const sourceName = item.news_sources?.name || 'College';

  return (
    <article className="bg-navbar shadow-soft rounded-soft-lg p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${categoryBadgeClass(
            item.category
          )}`}
        >
          {item.category || 'general'}
        </span>

        <span className="text-xs text-text-muted">
          {formatDate(item.published_at || item.published_date)}
        </span>
      </div>

      <h3 className="font-semibold text-text-main leading-snug">
        {item.title}
      </h3>

      {item.content && (
        <p className="text-sm text-text-muted leading-relaxed">
          {excerpt(item.content)}
        </p>
      )}

      <div className="mt-auto pt-2 flex items-center justify-between text-xs text-text-muted">
        <span>via {sourceName}</span>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary font-medium hover:underline"
          >
            Read more
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
}

function NewsPage() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const PAGE_SIZE = 12;

  const load = useCallback(
    async (targetPage, { append = false } = {}) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
        });

        if (category !== 'all') {
          params.set('category', category);
        }

        if (search.trim()) {
          params.set('q', search.trim());
        }

        const response = await api.get(`/api/news?${params.toString()}`);

        const data = Array.isArray(response?.data)
          ? response.data
          : [];

        const responseTotal = Number(response?.total) || 0;

        setTotal(responseTotal);

        setItems((previousItems) =>
          append
            ? [...previousItems, ...data]
            : data
        );

        setPage(targetPage);
      } catch (err) {
        console.error('Failed to load news:', err);

        setError(
          err?.message || 'Failed to load news'
        );
      } finally {
        setLoading(false);
      }
    },
    [category, search]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const hasMore = items.length < total;

  return (
    <main className="min-h-screen bg-bg-soft">
      {/* Header */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper
            className="text-primary"
            size={28}
          />

          <h1 className="text-2xl md:text-3xl font-bold text-text-main">
            News &amp; Announcements
          </h1>
        </div>

        <p className="text-text-muted text-sm md:text-base">
          Latest updates, notices and stories from MBSCET — verified and
          published by the college.
        </p>
      </section>

      {/* Filters */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-4">
        <div className="bg-navbar shadow-soft rounded-soft-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex flex-wrap gap-2 flex-1">
            {CATEGORIES.map((categoryName) => (
              <button
                key={categoryName}
                type="button"
                onClick={() => setCategory(categoryName)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize transition ${
                  category === categoryName
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-surface text-text-muted hover:text-primary'
                }`}
              >
                {categoryName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search news…"
                className="pl-8 pr-3 py-2 text-sm rounded-soft bg-surface border border-black/5 focus:outline-none focus:ring-2 focus:ring-primary/30 w-44 md:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() => load(1)}
              className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-primary transition"
              aria-label="Refresh news"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* News Feed */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-16">
        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-soft p-4 text-sm mb-4">
            {error} — please try again.
          </div>
        )}

        {/* Loading */}
        {loading && items.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="bg-navbar shadow-soft rounded-soft-lg p-5 animate-pulse"
              >
                <div className="h-5 w-24 rounded-full bg-black/5 mb-4" />

                <div className="h-4 bg-black/5 rounded mb-2" />

                <div className="h-4 bg-black/5 rounded mb-2 w-4/5" />

                <div className="h-4 bg-black/5 rounded w-3/5" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 text-text-muted">
            <Newspaper
              size={40}
              className="mx-auto mb-3 opacity-40"
            />

            <p className="font-medium">
              No news published yet.
            </p>

            <p className="text-sm">
              Check back soon — announcements will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* News Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={() =>
                    load(page + 1, { append: true })
                  }
                  disabled={loading}
                  className="bg-primary text-white px-6 py-2.5 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium"
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default NewsPage;