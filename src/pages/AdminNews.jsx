import { useCallback, useEffect, useState } from 'react';
import {
  Newspaper,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Flag,
  Send,
  Undo2,
  Pencil,
  X,
  Rss,
} from 'lucide-react';
import { api } from '../lib/api';

const CATEGORIES = [
  'exam',
  'holiday',
  'result',
  'admission',
  'scholarship',
  'event',
  'placement',
  'deadline',
  'timetable',
  'academic',
  'administrative',
  'general',
  'urgent',
];

const SOURCE_TYPES = [
  'official_college',
  'official_university',
  'official_department',
  'approved_external',
];

const SOURCE_CATEGORIES = ['general', 'exam', 'admission', 'placement', 'academic', 'administrative'];

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'flagged'];

const inputCls =
  'px-3 py-2 text-sm rounded-soft bg-surface border border-black/5 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

const labelCls = 'block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1';

function Badge({ tone = 'gray', children }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

function verificationTone(status) {
  if (status === 'verified') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'flagged') return 'amber';
  return 'blue';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return <div className="bg-red-50 text-red-700 rounded-soft p-3 text-sm">{message}</div>;
}

function OkNote({ message }) {
  if (!message) return null;
  return <div className="bg-emerald-50 text-emerald-700 rounded-soft p-3 text-sm">{message}</div>;
}

function ItemsTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filters, setFilters] = useState({ verificationStatus: '', isPublished: '', category: '', q: '' });
  const [sources, setSources] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ sourceId: '', title: '', url: '', content: '', category: 'general', isPublished: true });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', url: '', content: '', category: '' });
  const [savingId, setSavingId] = useState(null);

  const PAGE_SIZE = 20;

  const load = useCallback(
    async (targetPage = 1, { append = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
        if (filters.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
        if (filters.isPublished) params.set('isPublished', filters.isPublished);
        if (filters.category) params.set('category', filters.category);
        if (filters.q.trim()) params.set('q', filters.q.trim());
        const res = await api.get(`/api/news/admin/items?${params.toString()}`);
        const data = res?.data || [];
        setTotal(res?.total || 0);
        setItems((prev) => (append ? [...prev, ...data] : data));
        setPage(targetPage);
      } catch (err) {
        setError(err.message || 'Failed to load news items');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/news/sources');
        setSources(res?.data || []);
      } catch (_) {
        setSources([]);
      }
    })();
  }, []);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) flash(successMsg);
      await load(1);
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  const verify = (id, status) =>
    runAction(() => api.put(`/api/news/admin/items/${id}/verify`, { status }), status === 'verified' ? 'News verified and published' : `News ${status}`);

  const publish = (id, isPublished) =>
    runAction(() => api.put(`/api/news/admin/items/${id}/publish`, { isPublished }), isPublished ? 'News published' : 'News unpublished');

  const remove = (item) => {
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;
    runAction(() => api.delete(`/api/news/admin/items/${item.id}`), 'News deleted');
  };

  const create = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.sourceId) {
      setFormError('Select a source');
      return;
    }
    if (!form.title.trim() || !form.url.trim()) {
      setFormError('Title and URL are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/news/admin/items', {
        ...form,
        title: form.title.trim(),
        url: form.url.trim(),
        content: form.content.trim() || null,
      });
      setForm({ sourceId: '', title: '', url: '', content: '', category: 'general', isPublished: true });
      setShowCreate(false);
      flash('News created');
      await load(1);
    } catch (err) {
      setFormError(err.message || 'Failed to create news');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ title: item.title || '', url: item.url || '', content: item.content || '', category: item.category || 'general' });
  };

  const saveEdit = (id) =>
    runAction(async () => {
      setSavingId(id);
      try {
        await api.put(`/api/news/admin/items/${id}`, {
          title: editForm.title.trim(),
          url: editForm.url.trim(),
          content: editForm.content.trim() || null,
          category: editForm.category,
        });
        setEditingId(null);
      } finally {
        setSavingId(null);
      }
    }, 'News updated');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filters.verificationStatus} onChange={(e) => setFilters((f) => ({ ...f, verificationStatus: e.target.value }))} className={`${inputCls} w-auto`}>
          <option value="">All verification</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filters.isPublished} onChange={(e) => setFilters((f) => ({ ...f, isPublished: e.target.value }))} className={`${inputCls} w-auto`}>
          <option value="">Published + hidden</option>
          <option value="true">Published only</option>
          <option value="false">Hidden only</option>
        </select>
        <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className={`${inputCls} w-auto`}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input type="text" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search title…" className={`${inputCls} w-44`} />
        <button onClick={() => load(1)} className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-primary transition" aria-label="Refresh">
          <RefreshCw size={15} />
        </button>
        <button onClick={() => setShowCreate((s) => !s)} className="ml-auto flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-soft shadow-soft hover:bg-primary-dark transition text-sm font-medium">
          {showCreate ? <X size={15} /> : <Plus size={15} />} {showCreate ? 'Cancel' : 'Create News'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-navbar shadow-soft rounded-soft-lg p-5 space-y-3">
          <h3 className="font-semibold text-text-main text-sm">Manually publish a news item</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Source *">
              <select value={form.sourceId} onChange={(e) => setForm((f) => ({ ...f, sourceId: e.target.value }))} className={inputCls} required>
                <option value="">Select a source…</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title *">
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} maxLength={300} />
          </Field>
          <Field label="URL *">
            <input type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} placeholder="https://…" />
          </Field>
          <Field label="Content">
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className={`${inputCls} min-h-24`} rows={4} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text-main">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Publish immediately
          </label>
          <ErrorNote message={formError} />
          <button type="submit" disabled={creating} className="bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium">
            {creating ? 'Saving…' : 'Create news item'}
          </button>
        </form>
      )}

      <OkNote message={notice} />
      <ErrorNote message={error} />

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-navbar shadow-soft rounded-soft p-4 animate-pulse">
              <div className="h-4 bg-black/5 rounded w-2/3 mb-2" />
              <div className="h-3 bg-black/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 text-text-muted text-sm">No news items match these filters.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-navbar shadow-soft rounded-soft p-4">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
                  <input type="url" value={editForm.url} onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} />
                  <textarea value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} className={`${inputCls} min-h-20`} rows={3} />
                  <div className="flex gap-2">
                    <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className={`${inputCls} w-auto`}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button onClick={() => saveEdit(item.id)} disabled={savingId === item.id} className="bg-primary text-white px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-60">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="bg-surface px-4 py-2 rounded-soft text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge tone={verificationTone(item.verification_status)}>{item.verification_status}</Badge>
                    {item.is_published ? <Badge tone="green">published</Badge> : <Badge tone="gray">hidden</Badge>}
                    <Badge>{item.category || 'general'}</Badge>
                    <span className="text-xs text-text-muted">via {item.news_sources?.name || '—'} · {formatDate(item.published_at)}</span>
                  </div>
                  <p className="font-medium text-text-main text-sm mb-2">{item.title}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {item.is_published ? (
                      <button onClick={() => publish(item.id, false)} className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-soft hover:text-primary transition">
                        <Undo2 size={13} /> Unpublish
                      </button>
                    ) : (
                      <button onClick={() => publish(item.id, true)} className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-soft hover:text-primary transition">
                        <Send size={13} /> Publish
                      </button>
                    )}
                    {item.verification_status !== 'verified' && (
                      <button onClick={() => verify(item.id, 'verified')} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-soft hover:opacity-80 transition">
                        <CheckCircle2 size={13} /> Verify
                      </button>
                    )}
                    {item.verification_status !== 'rejected' && (
                      <button onClick={() => verify(item.id, 'rejected')} className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1.5 rounded-soft hover:opacity-80 transition">
                        <XCircle size={13} /> Reject
                      </button>
                    )}
                    {item.verification_status !== 'flagged' && (
                      <button onClick={() => verify(item.id, 'flagged')} className="flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-soft hover:opacity-80 transition">
                        <Flag size={13} /> Flag
                      </button>
                    )}
                    <button onClick={() => startEdit(item)} className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-soft hover:text-primary transition">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => remove(item)} className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1.5 rounded-soft hover:opacity-80 transition">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length < total && (
            <div className="flex justify-center pt-2">
              <button onClick={() => load(page + 1, { append: true })} disabled={loading} className="bg-surface px-5 py-2 rounded-soft text-sm font-medium hover:text-primary disabled:opacity-60 transition">
                {loading ? 'Loading…' : `Load more (${items.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function SourcesTab() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', type: 'official_college', category: 'general', checkFrequencyHours: 24 });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/news/sources');
      setSources(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const remove = (source) => {
    if (!window.confirm(`Delete source "${source.name}"? Its news items will also be deleted.`)) return;
    (async () => {
      try {
        await api.delete(`/api/news/sources/${source.id}`);
        flash('Source deleted');
        await load();
      } catch (err) {
        setError(err.message || 'Failed to delete source');
      }
    })();
  };

  const toggleActive = (source) => {
    (async () => {
      try {
        await api.put(`/api/news/sources/${source.id}`, { isActive: !source.is_active });
        flash(source.is_active ? 'Source deactivated' : 'Source activated');
        await load();
      } catch (err) {
        setError(err.message || 'Failed to update source');
      }
    })();
  };

  const create = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.url.trim()) {
      setFormError('Name and URL are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/news/sources', {
        name: form.name.trim(),
        url: form.url.trim(),
        type: form.type,
        category: form.category,
        checkFrequencyHours: Number(form.checkFrequencyHours) || 24,
      });
      setForm({ name: '', url: '', type: 'official_college', category: 'general', checkFrequencyHours: 24 });
      flash('Source added');
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create source');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="bg-navbar shadow-soft rounded-soft-lg p-5 space-y-3">
        <h3 className="font-semibold text-text-main text-sm">Add a news source</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name *">
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. University Exam Cell" />
          </Field>
          <Field label="URL *">
            <input type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} placeholder="https://…" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
              {SOURCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Check frequency (hours)">
            <input type="number" min={1} max={168} value={form.checkFrequencyHours} onChange={(e) => setForm((f) => ({ ...f, checkFrequencyHours: e.target.value }))} className={inputCls} />
          </Field>
        </div>
        <ErrorNote message={formError} />
        <button type="submit" disabled={creating} className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-soft shadow-soft hover:bg-primary-dark disabled:opacity-60 transition text-sm font-medium">
          <Plus size={15} /> {creating ? 'Saving…' : 'Add source'}
        </button>
      </form>

      <OkNote message={notice} />
      <ErrorNote message={error} />

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-navbar shadow-soft rounded-soft p-4 animate-pulse">
              <div className="h-4 bg-black/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-14 text-text-muted text-sm">No sources configured yet. Add one above — the Phase 5 AI agent will monitor it.</div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="bg-navbar shadow-soft rounded-soft p-4 flex flex-wrap items-center gap-3">
              <Rss size={16} className="text-primary shrink-0" />
              <div className="flex-1 min-w-48">
                <p className="font-medium text-text-main text-sm">{s.name}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-primary truncate block max-w-md">
                  {s.url}
                </a>
              </div>
              <Badge tone="blue">{s.type}</Badge>
              <Badge>{s.category || 'general'}</Badge>
              <span className="text-xs text-text-muted">every {s.check_frequency_hours}h</span>
              <button onClick={() => toggleActive(s)} className={`text-xs px-3 py-1.5 rounded-soft transition ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => remove(s)} className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-soft hover:opacity-80 transition">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNews() {
  const [tab, setTab] = useState('items');

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Newspaper className="text-primary" size={26} />
        <h1 className="text-xl md:text-2xl font-bold text-text-main">News Management</h1>
        <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full ml-auto">Admin</span>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          { id: 'items', label: 'News Items' },
          { id: 'sources', label: 'Sources' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-soft text-sm font-medium transition ${
              tab === t.id ? 'bg-primary text-white shadow-soft' : 'bg-surface text-text-muted hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'items' ? <ItemsTab /> : <SourcesTab />}
    </div>
  );
}

