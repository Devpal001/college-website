// ============================================
// AI PROVIDER CONFIGURATION (Phase 6)
// ============================================
// Loads and normalizes all AI provider environment variables.
// Fails open: if a key or provider is misconfigured, the app
// still works via the keyword classifier. Never throws.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve the repo root .env regardless of the npm working directory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
try { dotenv.config({ path: envPath, override: false }); } catch { /* ignore */ }

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------
//
// AI_PROVIDER selects the active paid/free API provider. Valid values:
//   gemini   -> Google Gemini (free tier: gemini-2.5-flash-lite)
//   openai   -> OpenAI (existing OPENAI_API_KEY path)
//   unset/any other value -> fall through to `getKey()` heuristics
//   (defaults to the heuristic classifier).
//
// We deliberately do NOT default to a specific provider when the
// environment is ambiguous. Explicit `AI_PROVIDER` + key is the only
// way to enable an external API; anything else falls back to the
// built-in keyword classifier.
// ---------------------------------------------------------------------------

const AI_PROVIDER = (process.env.AI_PROVIDER || '').trim().toLowerCase();


const AI_PROVIDER_SETTING =
  AI_PROVIDER === 'gemini' || AI_PROVIDER === 'openai' ? AI_PROVIDER : 'auto';

// ---------------------------------------------------------------------------
// Gemini configuration (free tier)
// ---------------------------------------------------------------------------
// The Google docs page used during planning (2026-10-27) confirms that
// `gemini-2.5-flash-lite` is on the STANDARD FREE TIER (input $0.00 /
// output $0.00 per 1M tokens) and supports temperature, system
// instructions and output token limits. It is a stable (non-preview)
// text-only model and is the recommended free-tier model for this app.
// See: https://ai.google.dev/gemini-api/docs/pricing
//      https://ai.google.dev/gemini-api/docs/rate-limits
//
// IMPORTANT: these are OUR app-level output limits, NOT the provider's
// total free quota. Respect the provider's real model context (1M input /
// 8K output for flash-lite) and rate limits (RPM/TPM/RPD per project).
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

export const AI_TEMPERATURE = Number(
  (process.env.AI_TEMPERATURE !== undefined && process.env.AI_TEMPERATURE !== '')
    ? process.env.AI_TEMPERATURE
    : (process.env.OPENAI_TEMPERATURE !== undefined && process.env.OPENAI_TEMPERATURE !== ''
      ? process.env.OPENAI_TEMPERATURE
      : 0.7)
);

export const AI_MAX_OUTPUT_TOKENS = Number(
  (process.env.AI_MAX_OUTPUT_TOKENS !== undefined && process.env.AI_MAX_OUTPUT_TOKENS !== '')
    ? process.env.AI_MAX_OUTPUT_TOKENS
    : (process.env.OPENAI_MAX_TOKENS !== undefined && process.env.OPENAI_MAX_TOKENS !== ''
      ? process.env.OPENAI_MAX_TOKENS
      : 1000)
);

// ---------------------------------------------------------------------------
// Legacy OpenAI configuration (kept for backwards compatibility)
// ---------------------------------------------------------------------------
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

// A placeholder key from a forgotten `.env` must never be treated as "configured".
function isRealOpenAIKey(key) {
  return typeof key === 'string' && key.startsWith('sk-') && key.length > 10;
}

function isRealGeminiKey(key) {
  // Real Gemini keys start with "AIza" (Google API key) or "@".
  return typeof key === 'string' && (key.startsWith('AIza') || key.startsWith('@'));
}

// ---------------------------------------------------------------------------
// Active key resolution (never expose or print)
// ---------------------------------------------------------------------------

export function getActiveProvider() {
  if (AI_PROVIDER_SETTING === 'gemini' || isRealGeminiKey(GEMINI_API_KEY)) return 'gemini';
  if (AI_PROVIDER_SETTING === 'openai' || isRealOpenAIKey(OPENAI_API_KEY)) return 'openai';
  return 'heuristic';
}

export function getAiKey() {
  if (getActiveProvider() === 'gemini') return GEMINI_API_KEY;
  if (getActiveProvider() === 'openai') return OPENAI_API_KEY;
  return '';
}



// Input truncation limit for AI classification
export const AI_INPUT_MAX_CHARS = Number(process.env.AI_INPUT_MAX_CHARS || 4000);

export function getOpenAIKey() {
  const key = (OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;
  if (key.startsWith("sk-") && key.length > 10) return key;
  return null;
}

export const AI_MODE = (getActiveProvider() === "heuristic") ? "heuristic" : getActiveProvider();
