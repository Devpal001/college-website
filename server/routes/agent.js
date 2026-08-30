import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { runAgentCycle } from '../lib/agentEngine.js';
import { AI_MODE } from '../lib/ai.js';
import { schedulerStatus } from '../lib/scheduler.js';
import { supabase } from '../lib/db.js';

const router = Router();

// Agent endpoints are admin-only (Phase 5 review workflow backend)
router.use(authRequired, requireRole('admin', 'super_admin'));

// ============================================
// GET /api/agent/status
// AI mode, scheduler state, pending review count
// ============================================
router.get('/status', async (req, res) => {
  try {
    const [pending, activeSources] = await Promise.all([
      supabase
        .from('news_items')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      supabase
        .from('news_sources')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    res.json({
      aiMode: AI_MODE,
      scheduler: schedulerStatus(),
      pendingReview: pending.count || 0,
      activeSources: activeSources.count || 0,
    });
  } catch (error) {
    console.error('Agent status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/agent/run
// Run a source-check cycle now. Body: { sourceId? }
// ============================================
router.post('/run', async (req, res) => {
  try {
    const { sourceId } = req.body || {};
    if (sourceId && !/^[0-9a-f-]{36}$/i.test(sourceId)) {
      return res.status(400).json({ error: 'sourceId must be a valid UUID' });
    }
    const result = await runAgentCycle({ sourceId: sourceId || null, trigger: 'manual' });
    res.json(result);
  } catch (error) {
    console.error('Agent run error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/agent/runs?page=&limit=
// Recent agent runs with source names
// ============================================
router.get('/runs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const from = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('ai_agent_runs')
      .select('*, news_sources(name, type)', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;
    res.json({ data: data || [], page, limit, total: count || 0 });
  } catch (error) {
    console.error('Agent runs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/agent/runs/:id
// Run detail including its event timeline
// ============================================
router.get('/runs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: run, error } = await supabase
      .from('ai_agent_runs')
      .select('*, news_sources(name, type, url)')
      .eq('id', id)
      .single();
    if (error || !run) return res.status(404).json({ error: 'Run not found' });

    const { data: events } = await supabase
      .from('ai_agent_events')
      .select('*')
      .eq('agent_run_id', id)
      .order('timestamp', { ascending: true });

    res.json({ ...run, events: events || [] });
  } catch (error) {
    console.error('Agent run detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
