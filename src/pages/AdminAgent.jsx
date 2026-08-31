import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Play, RefreshCw, ChevronDown, ChevronUp, Newspaper, Zap, Clock } from 'lucide-react';
import { api } from '../lib/api';

function Badge({ tone = 'gray', children }) {
  const tones = {
    green: 'bg-success/10 text-success-dark',
    red: 'bg-error/10 text-error-dark',
    amber: 'bg-warning/10 text-warning-dark',
    blue: 'bg-info/10 text-info-dark',
    gray: 'bg-text-muted/10 text-text-muted',
  };
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminAgent() {
  const [status, setStatus] = useState(null);
  const [sources, setSources] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [cycleRunning, setCycleRunning] = useState(false);
  const [sourceRunning, setSourceRunning] = useState(null);

  const [expandedRun, setExpandedRun] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, sourcesRes, runsRes] = await Promise.all([
        api.get('/api/agent/status'),
        api.get('/api/news/sources'),
        api.get('/api/agent/runs?limit=15'),
      ]);
      setStatus(statusRes || {});
      setSources(sourcesRes?.data || []);
      setRuns(runsRes?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runCycle = async (sourceId = null) => {
    setError(null);
    if (sourceId) setSourceRunning(sourceId);
    else setCycleRunning(true);
    try {
      const res = await api.post('/api/agent/run', sourceId ? { sourceId } : {});
      const totals = (res?.runs || []).reduce(
        (acc, r) => ({ inserted: acc.inserted + (r.inserted || 0), failed: acc.failed + (r.status === 'failed' ? 1 : 0) }),
        { inserted: 0, failed: 0 }
      );
      flash(`Cycle complete — ${res?.checked || 0} source(s) checked, ${totals.inserted} new item(s), ${totals.failed} failure(s)`);
      await load();
    } catch (err) {
      setError(err.message || 'Agent run failed');
    } finally {
      setSourceRunning(null);
      setCycleRunning(false);
    }
  };

  const toggleRun = async (runId) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setRunDetail(null);
      return;
    }
    setExpandedRun(runId);
    setRunDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/agent/runs/${runId}`);
      setRunDetail(res || null);
    } catch (err) {
      setRunDetail({ events: [], error: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-bg-soft">
        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-10 pb-16 space-y-4">
          <div className="h-8 w-64 bg-black/5 rounded animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-navbar shadow-soft rounded-soft-lg animate-pulse" />
            ))}
          </div>
          <div className="h-40 bg-navbar shadow-soft rounded-soft-lg animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-soft">
      <section className="max-w-5xl mx-auto px-4 md:px-8 pt-10 pb-20">
        <header className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <Bot className="text-primary" size={28} />
            <h1 className="text-2xl md:text-3xl font-bold text-text-main">AI News Agent</h1>
          </div>
          <Link to="/admin/news" className="text-sm text-primary font-medium hover:underline whitespace-nowrap">
            News console →
          </Link>
        </header>
        <p className="text-text-muted text-sm mb-6">
          Automated source monitoring — checks active sources, extracts candidate articles,
          deduplicates and classifies them for your review.
        </p>

        {error && <div className="bg-error/10 text-error-dark rounded-soft p-3 text-sm mb-4">{error}</div>}
        {notice && <div className="bg-success/10 text-success-dark rounded-soft p-3 text-sm mb-4">{notice}</div>}

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-navbar shadow-soft rounded-soft-lg p-4">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">AI mode</p>
            <p className="font-bold text-text-main capitalize">{status?.aiMode === 'openai' ? 'OpenAI' : 'Heuristics'}</p>
          </div>
          <div className="bg-navbar shadow-soft rounded-soft-lg p-4">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Scheduler</p>
            <p className="font-bold text-text-main">
              {status?.scheduler?.enabled ? `every ${status.scheduler.intervalMinutes}m` : 'off'}
            </p>
          </div>
          <div className="bg-navbar shadow-soft rounded-soft-lg p-4">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Pending review</p>
            <p className="font-bold text-warning-dark">{status?.pendingReview ?? 0}</p>
          </div>
          <div className="bg-navbar shadow-soft rounded-soft-lg p-4">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Active sources</p>
            <p className="font-bold text-text-main">{status?.activeSources ?? 0}</p>
          </div>
        </div>

        {/* Run controls */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => runCycle(null)}
            disabled={cycleRunning}
            className="flex items-center gap-1.5 bg-primary text-white px-5 py-2.5 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium"
          >
            <Zap size={15} /> {cycleRunning ? 'Running cycle…' : 'Run full cycle now'}
          </button>
          <button
            onClick={load}
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-primary transition"
            aria-label="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          {status?.scheduler?.enabled && (
            <span className="text-xs text-text-muted flex items-center gap-1 ml-1">
              <Clock size={12} /> background scheduler active
            </span>
          )}
        </div>

        {/* Sources */}
        <h2 className="font-semibold text-text-main mb-2">Sources</h2>
        {sources.length === 0 ? (
          <div className="bg-navbar shadow-soft rounded-soft p-5 text-sm text-text-muted mb-6">
            No sources configured yet — add them in the{' '}
            <Link to="/admin/news" className="text-primary hover:underline">news console</Link>.
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {sources.map((s) => (
              <div key={s.id} className="bg-navbar shadow-soft rounded-soft p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-48">
                  <p className="font-medium text-text-main text-sm">{s.name}</p>
                  <p className="text-xs text-text-muted truncate">{s.url}</p>
                </div>
                <Badge>{s.type?.replace('official_', '') || 'source'}</Badge>
                <span className="text-xs text-text-muted">
                  last checked: {s.last_checked_at ? fmtDateTime(s.last_checked_at) : 'never'}
                </span>
                <button
                  onClick={() => runCycle(s.id)}
                  disabled={cycleRunning || sourceRunning === s.id}
                  className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-soft text-xs font-medium hover:text-primary disabled:opacity-60 transition"
                >
                  <Play size={12} /> {sourceRunning === s.id ? 'Checking…' : 'Check now'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Run history */}
        <h2 className="font-semibold text-text-main mb-2">Run history</h2>
        {runs.length === 0 ? (
          <div className="bg-navbar shadow-soft rounded-soft p-5 text-sm text-text-muted">
            No agent runs yet — trigger a cycle above to see results here.
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => {
              const result = run.result || {};
              const isExpanded = expandedRun === run.id;
              return (
                <div key={run.id} className="bg-navbar shadow-soft rounded-soft overflow-hidden">
                  <button
                    onClick={() => toggleRun(run.id)}
                    className="w-full p-4 flex flex-wrap items-center gap-3 text-left hover:bg-surface/50 transition"
                  >
                    {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                    <Badge tone={run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'blue'}>
                      {run.status}
                    </Badge>
                    <span className="font-medium text-text-main text-sm flex-1 min-w-40">
                      {run.news_sources?.name || 'Unknown source'}
                    </span>
                    <span className="text-xs text-text-muted">{fmtDateTime(run.started_at)}</span>
                    {run.status === 'completed' && (
                      <span className="text-xs text-text-muted">
                        {result.found ?? 0} found · {result.inserted ?? 0} new · {result.duplicates ?? 0} dup
                      </span>
                    )}
                    {run.status === 'failed' && (
                      <span className="text-xs text-error-dark truncate max-w-52">{run.error || 'failed'}</span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-text-muted/15 pt-3">
                      {detailLoading ? (
                        <p className="text-xs text-text-muted animate-pulse">Loading details…</p>
                      ) : runDetail?.error ? (
                        <p className="text-xs text-error-dark">{runDetail.error}</p>
                      ) : (
                        <>
                          <p className="text-xs text-text-muted mb-2">
                            <Newspaper size={12} className="inline mr-1" />
                            {runDetail?.news_sources?.url || '—'}
                          </p>
                          {(runDetail?.events || []).length === 0 ? (
                            <p className="text-xs text-text-muted">No events recorded for this run.</p>
                          ) : (
                            <ol className="space-y-1.5 mb-3">
                              {runDetail.events.map((ev) => (
                                <li key={ev.id} className="text-xs flex gap-2">
                                  <span className="text-text-muted shrink-0 w-28">{fmtDateTime(ev.timestamp)}</span>
                                  <span className="font-semibold text-primary shrink-0">{ev.event_type}</span>
                                  <span className="text-text-muted truncate">{JSON.stringify(ev.data)}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                          {run.status === 'completed' && (
                            <pre className="text-[11px] bg-surface rounded-soft p-3 overflow-x-auto text-text-muted">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
