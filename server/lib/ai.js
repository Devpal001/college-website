// ============================================
// HYBRID AI CLASSIFICATION (Phase 5)
// Uses OpenAI when OPENAI_API_KEY is configured,
// otherwise falls back to keyword heuristics.
// Never throws — always returns a usable result.
// ============================================

export const CATEGORIES = [
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

const KEYWORD_MAP = {
  exam: ['exam', 'examination', 'test schedule', 'datesheet', 'mid term', 'midterm', 'end term', 'semester exam'],
  admission: ['admission', 'apply', 'application form', 'prospectus', 'counselling', 'counseling', 'entrance', 'merit list'],
  result: ['result', 'results', 'declared', 'scorecard', 'grade card', 'gpa', 'sgpa', 'cgpa', 'revaluation'],
  scholarship: ['scholarship', 'stipend', 'fee waiver', 'financial aid', 'freeship', 'nsp portal'],
  event: ['fest', 'event', 'seminar', 'workshop', 'conference', 'cultural', 'competition', 'hackathon', 'webinar'],
  placement: ['placement', 'recruitment', 'recruiter', 'internship', 'job offer', 'package', 'drive', 'interview'],
  holiday: ['holiday', 'closed', 'vacation', 'break', 'off on'],
  deadline: ['deadline', 'last date', 'before', 'extension', 'extended till', 'closes on'],
  timetable: ['timetable', 'time table', 'class schedule', 'date sheet'],
  academic: ['syllabus', 'curriculum', 'lecture', 'faculty', 'academic', 'classes resume', 'batch'],
  administrative: ['notification', 'circular', 'office order', 'administration', 'registrar', 'notice'],
  urgent: ['urgent', 'immediate', 'emergency', 'asap', 'important notice'],
};

export const AI_MODE = process.env.OPENAI_API_KEY ? 'openai' : 'heuristic';

export function heuristicSummary(content, max = 280) {
  const text = (content || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + '…';
}

export function heuristicClassify(title, content) {
  const t = (title || '').toLowerCase();
  const c = (content || '').toLowerCase();
  let best = 'general';
  let bestScore = 0;

  for (const [category, words] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += 2;
      const occurrences = c.split(w).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 3);
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  const confidence = bestScore === 0 ? 0.4 : Math.min(0.92, 0.55 + bestScore * 0.04);
  return { category: best, confidence: Number(confidence.toFixed(2)), method: 'heuristic' };
}

async function llmClassify(title, content) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `You classify college news items for an Indian engineering college website. ` +
              `Choose exactly one category from: ${CATEGORIES.join(', ')}. ` +
              `Also give a confidence between 0 and 1 and a concise one-or-two sentence summary. ` +
              `Respond with JSON: {"category": string, "confidence": number, "summary": string}`,
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nContent: ${(content || '').slice(0, 3000)}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : null;
    if (!category) return null;

    const confidence = Number(parsed.confidence);
    return {
      category,
      confidence: Number.isFinite(confidence) ? Number(Math.max(0, Math.min(1, confidence)).toFixed(2)) : 0.6,
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim().slice(0, 500) : heuristicSummary(content),
      method: 'openai',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hybrid entry point. Tries the LLM first (when configured),
 * falls back to keyword heuristics on any failure.
 * @returns {Promise<{category: string, confidence: number, summary: string, method: string}>}
 */
export async function classifyNews({ title, content }) {
  const llm = await llmClassify(title, content);
  if (llm) return llm;

  const heuristic = heuristicClassify(title, content);
  return { ...heuristic, summary: heuristicSummary(content) };
}
