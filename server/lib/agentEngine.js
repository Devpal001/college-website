// ============================================
// NEWS AGENT ENGINE (Phase 5)
// Source checking, content extraction, dedup,
// classification and review-queue insertion.
// ============================================

import { createHash } from 'node:crypto';
import { supabase } from './db.js';
import { classifyNews, AI_MODE, heuristicSummary } from './ai.js';

const FETCH_TIMEOUT_MS = 12000;
const MAX_LINKS = 20;
const MAX_LINK_FETCHES = 3;
const USER_AGENT =
  'MBSCET-NewsAgent/1.0 (+college website; respectful fetcher)';

export function hashContent(title, content) {
  return createHash('sha256')
    .update(`${(title || '').trim().toLowerCase()}|${(content || '').trim().slice(0, 500).toLowerCase()}`)
    .digest('hex');
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

/**
 * Extracts page metadata and candidate article links from HTML.
 * Pure regex-based extraction — no external HTML parser dependency.
 */
export function extractCandidates(html, sourceUrl) {
  const base = new URL(sourceUrl);
  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const title = stripTags(titleTag || '') || metaContent(html, 'og:title') || '';
  const description =
    metaContent(html, 'description') || metaContent(html, 'og:description') || '';
  const text = stripTags(html).slice(0, 2000);

  const links = [];
  const seen = new Set();
  const linkRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) && links.length < MAX_LINKS) {
    const rawHref = (m[1] || '').trim();
    if (!rawHref || /^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;
    if (/\.(png|jpe?g|gif|svg|css|js|mjs|zip|rar|7z|ico|webp|mp4|mp3|pdf|docx?|xlsx?)$/i.test(rawHref.split('?')[0])) continue;

    let abs;
    try {
      abs = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (abs.origin !== base.origin) continue;
    if (!/^https?:$/.test(abs.protocol)) continue;
    if (abs.pathname === '/' || abs.pathname === '') continue;

    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const anchorText = stripTags(m[2] || '');
    if (anchorText.length < 15) continue; // skip nav-style short links

    links.push({ url: key, anchorText });
  }

  return { title, description, text, links };
}

export async function logAgentEvent(runId, eventType, data = null, metadata = null) {
  try {
    await supabase
      .from('ai_agent_events')
      .insert({ agent_run_id: runId, event_type: eventType, data, metadata });
  } catch (err) {
    console.error('Agent event log failed:', err.message || err);
  }
}

/**
 * Checks one source: fetches the page, extracts candidate items,
 * dedupes against existing news, classifies and inserts pending rows.
 */
export async function checkSource(source, runId) {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source.url}`);
  const html = await res.text();
  const { title, description, text, links } = extractCandidates(html, source.url);
  await logAgentEvent(runId, 'fetched_source', {
    bytes: html.length,
    linksFound: links.length,
    pageTitle: title || null,
  });

  const candidates = [];
  if (title && title.length >= 8) {
    const content = [description, text].filter(Boolean).join('\n\n').slice(0, 2000) || null;
    candidates.push({ url: source.url, title, content });
  }

  // Enrich the most promising links with a content fetch (bounded).
  const top = links.slice(0, MAX_LINK_FETCHES);
  const enriched = await Promise.all(
    top.map(async (l) => {
      try {
        const r = await fetchWithTimeout(l.url);
        if (!r.ok) return { ...l, content: null };
        const h = await r.text();
        const m = extractCandidates(h, l.url);
        return {
          ...l,
          fallbackTitle: m.title || null,
          content: [m.description, m.text].filter(Boolean).join('\n\n').slice(0, 2000) || null,
        };
      } catch {
        return { ...l, content: null };
      }
    })
  );

  for (const l of enriched) {
    const t = l.anchorText.length >= 15 ? l.anchorText : l.fallbackTitle || l.anchorText;
    if (t) candidates.push({ url: l.url, title: t, content: l.content });
  }
  for (const l of links.slice(MAX_LINK_FETCHES)) {
    candidates.push({ url: l.url, title: l.anchorText, content: null });
  }

  // Dedupe against the database by URL.
  const urls = [...new Set(candidates.map((c) => c.url))];
  let existingUrls = new Set();
  if (urls.length > 0) {
    const { data: existing } = await supabase
      .from('news_items')
      .select('url')
      .in('url', urls);
    existingUrls = new Set((existing || []).map((e) => e.url));
  }

  let inserted = 0;
  let duplicates = 0;
  const errors = [];

  for (const cand of candidates) {
    if (existingUrls.has(cand.url)) {
      duplicates++;
      continue;
    }
    if (!cand.title || cand.title.length < 8) continue;

    const cls = await classifyNews({ title: cand.title, content: cand.content });
    const { error } = await supabase
      .from('news_items')
      .insert({
        source_id: source.id,
        title: cand.title.slice(0, 300),
        content: cls.summary || cand.content || null,
        url: cand.url,
        category: cls.category,
        confidence_score: cls.confidence,
        verification_status: 'pending',
        content_hash: hashContent(cand.title, cand.content),
        is_published: false,
        target_audience: ['all'],
      });

    if (error) {
      errors.push(error.message);
    } else {
      inserted++;
      await logAgentEvent(runId, 'item_created', {
        title: cand.title.slice(0, 150),
        url: cand.url,
        category: cls.category,
        confidence: cls.confidence,
        method: cls.method,
      });
    }
  }

  await supabase
    .from('news_sources')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', source.id);

  const result = {
    found: candidates.length,
    inserted,
    duplicates,
    errors,
    mode: AI_MODE,
    summaryFallback: heuristicSummary(text, 120),
  };
  return result;
}

/**
 * Runs one agent cycle: picks due sources (or one explicit source),
 * creates a run row per source and checks each sequentially.
 * @returns {Promise<{checked: number, runs: Array}>}
 */
export async function runAgentCycle({ sourceId = null, trigger = 'manual' } = {}) {
  let query = supabase.from('news_sources').select('*').eq('is_active', true);
  if (sourceId) query = query.eq('id', sourceId);
  const { data: sources, error } = await query;
  if (error) throw error;

  let due = sources || [];
  if (!sourceId) {
    due = due.filter((s) => {
      if (!s.last_checked_at) return true;
      const dueAt =
        new Date(s.last_checked_at).getTime() + (s.check_frequency_hours || 24) * 3600 * 1000;
      return Date.now() >= dueAt;
    });
  }

  const runs = [];
  for (const source of due) {
    const { data: run, error: runErr } = await supabase
      .from('ai_agent_runs')
      .insert({ agent_type: 'source_check', source_id: source.id, status: 'running', action: trigger })
      .select()
      .single();

    if (runErr) {
      runs.push({ source: source.name, status: 'failed', error: runErr.message });
      continue;
    }

    await logAgentEvent(run.id, 'cycle_start', { trigger, source: source.name });

    try {
      const result = await checkSource(source, run.id);
      await supabase
        .from('ai_agent_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), result })
        .eq('id', run.id);
      await logAgentEvent(run.id, 'cycle_complete', result);
      runs.push({ runId: run.id, source: source.name, status: 'completed', ...result });
    } catch (err) {
      const message = String(err.message || err);
      await supabase
        .from('ai_agent_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: message })
        .eq('id', run.id);
      await logAgentEvent(run.id, 'cycle_error', { error: message });
      runs.push({ runId: run.id, source: source.name, status: 'failed', error: message });
    }
  }

  return { checked: due.length, runs };
}

