import { Router } from 'express';
import { supabase } from '../lib/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// PHASE 4 — NEWS INFRASTRUCTURE
// Public: news feed, single item, active sources.
// Admin: source management + manual news management
// + verification/publish workflow (AI review comes in Phase 5).
//
// This router is mounted BEFORE the legacy inline news
// handlers in index.js, so it takes precedence and closes
// the unauthenticated legacy /verify and /pending-review holes.
// ============================================

const NEWS_CATEGORIES = [
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

const SOURCE_CATEGORIES = [
  'general',
  'exam',
  'admission',
  'placement',
  'academic',
  'administrative',
];

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'flagged'];

// Admin guard — every /admin/* route requires an authenticated admin.
const adminGuard = [authRequired, requireRole('admin', 'super_admin')];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NEWS_SELECT = '*, news_sources(id, name, url, type, category)';

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const parsedLimit = Number.parseInt(query.limit, 10) || 12;
  const limit = Math.min(100, Math.max(1, parsedLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// ============================================
// PUBLIC ROUTES — no authentication required
// ============================================

// GET /api/news — published news feed with filters + pagination
router.get('/', async (req, res) => {
  try {
    const { category, sourceId, q } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    if (category && !NEWS_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${NEWS_CATEGORIES.join(', ')}` });
    }
    if (sourceId && !isUuid(sourceId)) {
      return res.status(400).json({ error: 'sourceId must be a valid UUID' });
    }

    let query = supabase
      .from('news_items')
      .select(NEWS_SELECT, { count: 'exact' })
      .eq('is_published', true);

    if (category) query = query.eq('category', category);
    if (sourceId) query = query.eq('source_id', sourceId);
    if (q) query = query.ilike('title', `%${String(q).slice(0, 120)}%`);

    const { data, error, count } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ data, page, limit, total: count ?? data.length });
  } catch (error) {
    console.error('Get news feed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/news/sources — active news sources (public)
router.get('/sources', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('id, name, url, type, category, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Get news sources error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/news/admin/pending-review — items awaiting verification.
// Declared before /:id so 'admin' is not captured as an id.
// NOTE: intentionally admin-only (the legacy public version leaked
// unpublished news) — shadows the legacy unauthenticated route.
router.get('/admin/pending-review', ...adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select(NEWS_SELECT)
      .eq('verification_status', 'pending')
      .order('retrieved_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Get pending news error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/news/:id — single news item (published only for the public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(404).json({ error: 'News item not found' });
    }

    const { data, error } = await supabase
      .from('news_items')
      .select(NEWS_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data || (!data.is_published && !['admin', 'super_admin'].includes(req.profile?.role))) {
      return res.status(404).json({ error: 'News item not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES — source management
// ============================================

// GET /api/news/admin/sources — all sources (incl. inactive)
router.get('/admin/sources', ...adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('*')
      .order('priority', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('List news sources error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/news/admin/sources — create a news source
router.post('/admin/sources', ...adminGuard, async (req, res) => {
  try {
    const { name, url, type, category, priority, checkFrequencyHours, isActive } = req.body || {};

    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }
    if (!SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${SOURCE_TYPES.join(', ')}` });
    }
    if (category && !SOURCE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${SOURCE_CATEGORIES.join(', ')}` });
    }

    const row = {
      name: String(name).slice(0, 200),
      url: String(url).slice(0, 500),
      type,
      category: category || 'general',
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 1,
      check_frequency_hours: Number.isFinite(Number(checkFrequencyHours)) ? Number(checkFrequencyHours) : 24,
      is_active: isActive === undefined ? true : Boolean(isActive),
    };

    const { data, error } = await supabase.from('news_sources').insert(row).select().single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A source with that name or URL already exists' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Create news source error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/news/admin/sources/:id — update a news source
router.put('/admin/sources/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News source not found' });

    const { name, url, type, category, priority, checkFrequencyHours, isActive } = req.body || {};

    if (type !== undefined && !SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${SOURCE_TYPES.join(', ')}` });
    }
    if (category !== undefined && category !== null && !SOURCE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${SOURCE_CATEGORIES.join(', ')}` });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = String(name).slice(0, 200);
    if (url !== undefined) updates.url = String(url).slice(0, 500);
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (priority !== undefined) updates.priority = Number.isFinite(Number(priority)) ? Number(priority) : 1;
    if (checkFrequencyHours !== undefined) {
      updates.check_frequency_hours = Number.isFinite(Number(checkFrequencyHours))
        ? Number(checkFrequencyHours)
        : 24;
    }
    if (isActive !== undefined) updates.is_active = Boolean(isActive);

    const { data, error } = await supabase
      .from('news_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A source with that name or URL already exists' });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'News source not found' });

    res.json(data);
  } catch (error) {
    console.error('Update news source error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/news/admin/sources/:id
// Default: soft delete (deactivate) so linked news history is kept.
// ?hard=true performs a real delete; refused with 409 if items reference it.
router.delete('/admin/sources/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News source not found' });

    if (req.query.hard === 'true') {
      const { error } = await supabase.from('news_sources').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          return res.status(409).json({
            error: 'Source has news items linked to it. Deactivate it instead, or delete its items first.',
          });
        }
        throw error;
      }
      return res.status(204).send();
    }

    const { data, error } = await supabase
      .from('news_sources')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'News source not found' });

    res.json({ ...data, deleted: true });
  } catch (error) {
    console.error('Delete news source error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES — news item management
// ============================================

// GET /api/news/admin/items — filterable list for the admin console
router.get('/admin/items', ...adminGuard, async (req, res) => {
  try {
    const { verificationStatus, isPublished, category, sourceId, q } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    if (verificationStatus && !VERIFICATION_STATUSES.includes(verificationStatus)) {
      return res.status(400).json({ error: `verificationStatus must be one of: ${VERIFICATION_STATUSES.join(', ')}` });
    }
    if (category && !NEWS_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${NEWS_CATEGORIES.join(', ')}` });
    }
    if (sourceId && !isUuid(sourceId)) {
      return res.status(400).json({ error: 'sourceId must be a valid UUID' });
    }

    let query = supabase.from('news_items').select(NEWS_SELECT, { count: 'exact' });

    if (verificationStatus) query = query.eq('verification_status', verificationStatus);
    if (isPublished === 'true') query = query.eq('is_published', true);
    if (isPublished === 'false') query = query.eq('is_published', false);
    if (category) query = query.eq('category', category);
    if (sourceId) query = query.eq('source_id', sourceId);
    if (q) query = query.ilike('title', `%${String(q).slice(0, 120)}%`);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ data, page, limit, total: count ?? data.length });
  } catch (error) {
    console.error('List news items error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/news/admin/items — manually create a news item
router.post('/admin/items', ...adminGuard, async (req, res) => {
  try {
    const { sourceId, title, content, url, category, publishedDate, isPublished } = req.body || {};

    if (!sourceId || !isUuid(sourceId)) {
      return res.status(400).json({ error: 'sourceId must be a valid UUID' });
    }
    if (!title || !url) {
      return res.status(400).json({ error: 'title and url are required' });
    }
    if (category && !NEWS_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${NEWS_CATEGORIES.join(', ')}` });
    }

    const { data: source } = await supabase
      .from('news_sources')
      .select('id')
      .eq('id', sourceId)
      .maybeSingle();
    if (!source) return res.status(404).json({ error: 'News source not found' });

    const now = new Date().toISOString();
    const publishNow = Boolean(isPublished);

    const row = {
      source_id: sourceId,
      title: String(title).slice(0, 300),
      content: content ? String(content).slice(0, 20000) : null,
      url: String(url).slice(0, 500),
      category: category || 'general',
      published_date: publishedDate ? new Date(publishedDate).toISOString() : now,
      // Manual admin entries are trusted — no AI verification pipeline involved.
      verification_status: 'verified',
      is_published: publishNow,
      published_by: publishNow ? req.user.id : null,
      published_at: publishNow ? now : null,
    };

    const { data, error } = await supabase.from('news_items').insert(row).select(NEWS_SELECT).single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Create news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/news/admin/items/:id — edit a news item's content
router.put('/admin/items/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News item not found' });

    const { title, content, url, category, publishedDate } = req.body || {};

    if (category !== undefined && category !== null && !NEWS_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${NEWS_CATEGORIES.join(', ')}` });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = String(title).slice(0, 300);
    if (content !== undefined) updates.content = content ? String(content).slice(0, 20000) : null;
    if (url !== undefined) updates.url = String(url).slice(0, 500);
    if (category !== undefined) updates.category = category;
    if (publishedDate !== undefined) {
      updates.published_date = publishedDate ? new Date(publishedDate).toISOString() : null;
    }

    const { data, error } = await supabase
      .from('news_items')
      .update(updates)
      .eq('id', id)
      .select(NEWS_SELECT)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'News item not found' });

    res.json(data);
  } catch (error) {
    console.error('Update news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/news/admin/items/:id/verify — verification workflow.
// Shadows the legacy UNAUTHENTICATED /api/news/:id/verify endpoint;
// publishedBy is now always derived from the authenticated admin.
router.put('/admin/items/:id/verify', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News item not found' });

    const { status } = req.body || {};
    if (!VERIFICATION_STATUSES.includes(status) || status === 'pending') {
      return res.status(400).json({
        error: `status must be one of: ${VERIFICATION_STATUSES.filter((s) => s !== 'pending').join(', ')}`,
      });
    }

    const updateData = {
      verification_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'verified') {
      updateData.is_published = true;
      updateData.published_by = req.profile.id;
      updateData.published_at = new Date().toISOString();
    }

    if (status === 'rejected' || status === 'flagged') {
      updateData.is_published = false;
    }

    const { data, error } = await supabase
      .from('news_items')
      .update(updateData)
      .eq('id', id)
      .select(NEWS_SELECT)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'News item not found' });

    // Trigger notifications when news is published
    if (status === 'verified' && updateData.is_published) {
      setImmediate(async () => {
        try {
          // Get users who want AI discoveries
          const { data: preferences } = await supabase
            .from('notification_preferences')
            .select('user_id')
            .eq('ai_discoveries', true);

          if (preferences && preferences.length > 0) {
            const userIds = preferences.map(p => p.user_id);
            
            // Get news source for categorization
            const { data: source } = await supabase
              .from('news_sources')
              .select('name')
              .eq('id', data.source_id)
              .single();

            // Send notifications to eligible users
            const notifications = userIds.map(userId => ({
              user_id: userId,
              title: 'New College Update',
              message: data.title,
              type: 'ai_news',
              priority: 'normal',
              status: 'pending',
              data: { 
                newsId: data.id, 
                category: data.category,
                source: source?.name || 'College Website'
              },
              created_at: new Date().toISOString()
            }));

            await supabase.from('notifications').insert(notifications);
          }
        } catch (error) {
          console.error('Error triggering news notification:', error);
        }
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Verify news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/news/admin/items/:id/publish — publish / unpublish toggle
router.put('/admin/items/:id/publish', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News item not found' });

    const { isPublished } = req.body || {};
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ error: 'isPublished (boolean) is required' });
    }

    const { data: existing } = await supabase
      .from('news_items')
      .select('id, verification_status, published_at')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'News item not found' });

    const updateData = {
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    };

    if (isPublished) {
      if (existing.verification_status === 'rejected') {
        return res.status(400).json({ error: 'A rejected item cannot be published. Verify it first.' });
      }
      if (existing.verification_status === 'pending') {
        updateData.verification_status = 'verified';
      }
      if (!existing.published_at) {
        updateData.published_by = req.user.id;
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('news_items')
      .update(updateData)
      .eq('id', id)
      .select(NEWS_SELECT)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Publish news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/news/admin/items/:id — permanently remove a news item
router.delete('/admin/items/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'News item not found' });

    const { data, error } = await supabase.from('news_items').delete().eq('id', id).select('id').single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'News item not found' });

    res.status(204).send();
  } catch (error) {
    console.error('Delete news item error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;



