// ============================================
// AI PROVIDER BUS (Phase 6)
// ============================================
// Abstracts the two supported LLM providers behind a single interface:
//   classifyJson({system, user, ...}) -> Promise<{ok, data?, error?}>
//
// Supported providers:
//   - gemini   (free tier: gemini-2.5-flash-lite)
//   - openai   (existing OPENAI_API_KEY path, kept for compatibility)
//
// Key rules:
//   * Never print or log the API key or any part of an authorization
//     header. Only the provider slug is logged.
//   * Classifiers always return a bounded safe result; they never throw.

import { getActiveProvider, AI_TEMPERATURE, AI_MAX_OUTPUT_TOKENS } from './config.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';

const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

function buildSystemPrompt(system) {
  return typeof system === 'string' ? system : (system || '');
}

function buildUserText(user) {
  return typeof user === 'string' ? user : (user || '');
}

// Gemini: POST {model, contents, systemInstruction, generationConfig}
async function geminiGenerate({ system, user, temperature, maxOutputTokens, abortSignal }) {
  const geminiSystem = buildSystemPrompt(system);
  const geminiUser = buildUserText(user);

  const body = {
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${geminiSystem}\n\n${geminiUser}` }],
      },
    ],
    systemInstruction: geminiSystem ? { parts: [{ text: geminiSystem }] } : undefined,
    generationConfig: {
      temperature: Number.isFinite(temperature) ? temperature : 0.7,
      maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1000,
      responseMimeType: 'application/json',
    },
  };

  const controller = new AbortController();
  if (abortSignal) controller.signal = abortSignal;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY || '',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `Gemini HTTP ${res.status}`;
      try {
        const j = await res.json().catch(() => null);
        if (j?.error) detail = `${detail} - ${j.error.message || JSON.stringify(j.error)}`;
      } catch {
        // non-JSON body
      }
      return { ok: false, error: detail, status: res.status };
    }
    const json = await res.json();
    const text = extractGeminiText(json);
    if (!text) return { ok: false, error: 'Gemini returned no content' };
    return { ok: true, data: parseGeminiJson(text) };
  } catch (err) {
    const code = err?.name === 'AbortError' ? 'AI_REQUEST_TIMEOUT' : 'AI_REQUEST_FAILED';
    return { ok: false, error: code, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

// OpenAI: POST {model, messages, temperature, max_tokens, response_format}
async function openaiGenerate({ system, user, temperature, maxOutputTokens, abortSignal }) {
  const openaiSystem = buildSystemPrompt(system);
  const openaiUser = buildUserText(user);

  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: openaiSystem },
      { role: 'user', content: openaiUser },
    ],
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
    max_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1000,
    response_format: { type: 'json_object' },
  };

  const controller = new AbortController();
  if (abortSignal) controller.signal = abortSignal;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(OPENAI_CHAT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `OpenAI HTTP ${res.status}`;
      try {
        const j = await res.json().catch(() => null);
        if (j?.error) detail = `${detail} - ${j.error.message || JSON.stringify(j.error)}`;
      } catch {
        // non-JSON body
      }
      return { ok: false, error: detail, status: res.status };
    }
    const json = await res.json();
    const text =
      json?.choices?.[0]?.message?.content ||
      json?.error?.message ||
      undefined;
    if (text === undefined || text === null || text === '') {
      return { ok: false, error: 'OpenAI returned no content' };
    }
    return { ok: true, data: parseOpenAIJson(text) };
  } catch (err) {
    const code = err?.name === 'AbortError' ? 'AI_REQUEST_TIMEOUT' : 'AI_REQUEST_FAILED';
    return { ok: false, error: code, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// JSON extraction helpers
// ---------------------------------------------------------------------------
function extractGeminiText(json) {
  if (!json || typeof json !== 'object') return '';
  const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text ||
    json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  if (candidate) return candidate;
  const fallback = json.response?.result?.content?.parts?.[0]?.text ||
    json.response?.result?.content?.parts?.[0]?.inlineData?.data || '';
  return fallback;
}

function parseGeminiJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { raw: trimmed };
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function parseOpenAIJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { raw: trimmed };
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

export async function classifyJson({ system, user, ...rest } = {}) {
  const provider = getActiveProvider();
  if (provider === 'heuristic') {
    return { ok: false, error: 'NO_PROVIDER_CONFIGURED' };
  }

  const opts = {
    system: system || '',
    user: user || '',
    temperature: rest.temperature !== undefined ? rest.temperature : AI_TEMPERATURE,
    maxOutputTokens: rest.maxOutputTokens !== undefined ? rest.maxOutputTokens : AI_MAX_OUTPUT_TOKENS,
    abortSignal: rest.abortSignal,
  };

  if (provider === 'gemini') {
    return geminiGenerate(opts);
  }
  if (provider === 'openai') {
    return openaiGenerate(opts);
  }
  return { ok: false, error: 'UNKNOWN_PROVIDER' };
}
