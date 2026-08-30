// ============================================
// NEWS AGENT SCHEDULER (Phase 5)
// Lightweight background job: periodically runs
// the source-check cycle for due sources.
// Configure with AGENT_INTERVAL_MINUTES (0 disables).
// ============================================

import { runAgentCycle } from './agentEngine.js';

const INTERVAL_MINUTES = Number(process.env.AGENT_INTERVAL_MINUTES ?? 60);

let timer = null;
let running = false;

export function schedulerStatus() {
  return {
    enabled: INTERVAL_MINUTES > 0 && Boolean(timer),
    intervalMinutes: INTERVAL_MINUTES,
    currentlyRunning: running,
  };
}

async function tick() {
  if (running) return; // never overlap cycles
  running = true;
  try {
    const { checked } = await runAgentCycle({ trigger: 'scheduled' });
    if (checked > 0) {
      console.log(`🤖 Scheduled agent cycle completed — ${checked} source(s) checked`);
    }
  } catch (err) {
    console.error('🤖 Scheduled agent cycle failed:', err.message || err);
  } finally {
    running = false;
  }
}

export function startNewsScheduler() {
  if (globalThis.__newsSchedulerStarted) return schedulerStatus();
  globalThis.__newsSchedulerStarted = true;

  if (!INTERVAL_MINUTES || INTERVAL_MINUTES <= 0) {
    console.log('🤖 News agent scheduler disabled (AGENT_INTERVAL_MINUTES=0)');
    return schedulerStatus();
  }

  timer = setInterval(tick, INTERVAL_MINUTES * 60 * 1000);
  timer.unref?.();
  console.log(`🤖 News agent scheduler started — every ${INTERVAL_MINUTES} min (AI mode: heuristics/openai)`);
  return schedulerStatus();
}
