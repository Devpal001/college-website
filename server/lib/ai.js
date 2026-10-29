// ============================================
// HYBRID AI CLASSIFICATION (Phase 6)
// ============================================

import { classifyJson } from './providers.js';
import { getActiveProvider, AI_INPUT_MAX_CHARS, AI_MODE } from './config.js';

export { AI_MODE };

const PROVIDER_METHOD = (() => {
  const p = getActiveProvider();
  return p === 'gemini' ? 'gemini' : p === 'openai' ? 'openai' : 'heuristic';
})();

export const CATEGORIES = [
  'exam','holiday','result','admission','scholarship','event','placement','deadline','timetable','academic','administrative','general','urgent',
];

const KEYWORD_MAP = {
  exam: ['exam','examination','test schedule','datesheet','mid term','midterm','end term','semester exam'],
  admission: ['admission','apply','application form','prospectus','counselling','counseling','entrance','merit list'],
  result: ['result','results','declared','scorecard','grade card','gpa','sgpa','cgpa','revaluation'],
  scholarship: ['scholarship','stipend','fee waiver','financial aid','freeship','nsp portal'],
  event: ['fest','event','seminar','workshop','conference','cultural','competition','hackathon','webinar'],
  placement: ['placement','recruitment','recruiter','internship','job offer','package','drive','interview'],
  holiday: ['holiday','closed','vacation','break','off on'],
  deadline: ['deadline','last date','before','extension','extended till','closes on'],
  timetable: ['timetable','time table','class schedule','date sheet'],
  academic: ['syllabus','curriculum','lecture','faculty','academic','classes resume','batch'],
  administrative: ['notification','circular','office order','administration','registrar','notice'],
  urgent: ['urgent','immediate','emergency','asap','important notice'],
};

const INTENT_KEYWORDS = {
  attendance: ['attendance','attend','attended','present','absent','absence'],
  marks: ['marks','mark','score','scores','grade','grades','result','results','gpa','sgpa','cgpa','percent','percentage'],
  timetable: ['timetable','time table','schedule','class','classes','lecture','lectures','period'],
  announcement: ['announcement','announcements','notice','notices','circular','circulars'],
  news: ['news','update','updates','latest','headlines','happening'],
  teacher: ['teaching','assigned subjects','my subjects','assigned classes'],
  profile: ['profile','who am i','my information','my info','my account','my details'],
};

export function heuristicSummary(content, max = 280) {
  const text = String(content || '').trim();
  if (!text) return '';
  if (text.length <= max) return text; return text.slice(0, max).trim() + '...';
}


export function heuristicClassify(title, content) {
  const t = String(title || '').toLowerCase();
  const c = String(content || '').toLowerCase();
  let best = 'general';
  let bestScore = 0;
  for (const [category, words] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += 2;
      const occurrences = c.split(w).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 3);
    }
    if (score > bestScore) { bestScore = score; best = category; }
  }
  const confidence = bestScore === 0 ? 0.4 : Math.min(0.92, 0.55 + bestScore * 0.04);
  return { category: best, confidence: Number(confidence.toFixed(2)), method: 'heuristic' };
}

export function truncateInput(title, content) {
  const t = String(title || '').trim();
  const c = String(content || '').trim();
  const combined = t + '\n\n' + c;
  if (combined.length <= AI_INPUT_MAX_CHARS) return combined;
  const scale = AI_INPUT_MAX_CHARS / combined.length;
  return (t.slice(0, Math.ceil(t.length * scale)) + '\n\n' + c.slice(0, Math.ceil(c.length * scale))).slice(0, AI_INPUT_MAX_CHARS);
}


const VALID_INTENTS = Object.keys(INTENT_KEYWORDS);
async function llmClassifyNews(title, content){
  if (getActiveProvider() === 'heuristic') return null;
  var input = truncateInput(title, content);
  var system =
    'You are a precise news classifier for a college website. Classify into one of: ' + CATEGORIES.join(', ') + '. Return ONLY valid JSON with keys: category (string), confidence (number 0-1), summary (string). Keep summary concise (<= 280 chars). Do not invent categories outside the list.';
  var controller = new AbortController();
  var timer = setTimeout(function(){ try { controller.abort(); } catch{/*ignore*/} }, 8000);
  try {
    var res = await classifyJson({ system: system, user: input });
    if (!res.ok) return null;
    var data = res.data;
    if (!data || typeof data !== 'object') return null;
    if (data.raw !== undefined) return null; // provider returned unparseable text
    var category = String(data.category || '').toLowerCase().trim();
    if (CATEGORIES.indexOf(category) === -1) return null;
    var confidence = Number(data.confidence);
    if (!isFinite(confidence)) return null;
    var clamped = Math.max(0, Math.min(1, confidence));
    var summary = (typeof data.summary === 'string' && data.summary.trim()) ? data.summary.trim().slice(0, 500) : heuristicSummary(content);
    return { category: category, confidence: Number(clamped.toFixed(2)), summary: summary, method: PROVIDER_METHOD };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
export async function classifyNews({ title, content }) {
  var llm = await llmClassifyNews(title, content);
  if (llm) return llm;
  var heuristic = heuristicClassify(title, content);
  return Object.assign({}, heuristic, { summary: heuristicSummary(content) });
}
function heuristicClassifyIntent(message){
  var text = String(message || '').toLowerCase();
  var intents = [];
  var entries = Object.entries(INTENT_KEYWORDS);
for (var i = 0; i < entries.length; i++) {
    var intent = entries[i][0], words = entries[i][1];
    for (var j = 0; j < words.length; j++) {
      var escaped = words[j].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var re = new RegExp("\\b" + escaped + "\\b");
      if (re.test(text)) { intents.push(intent); break; }
    }
  }
  return intents;
}
export async function llmClassifyIntent(message){
  if (getActiveProvider() === 'heuristic') return [];
  var system =
    'You map a college student/teacher question to assistant capabilities. Capabilities: ' + VALID_INTENTS.join(', ') + '. Respond ONLY with JSON: {"intents": array of capability strings}. Use an empty array when the question matches none.';
  var controller = new AbortController();
  var timer = setTimeout(function(){ try { controller.abort(); } catch(_e) { void _e; } }, 8000);
  try {
    var res = await classifyJson({ system: system, user: String(message || '').slice(0, 500) });
    if (!res.ok) return [];
    var data = res.data;
    if (!data || typeof data !== 'object') return [];
    if (data.raw !== undefined) return []; // provider returned unparseable text
    if (!Array.isArray(data.intents)) return [];
    var filtered = [];
    for (var k = 0; k < data.intents.length; k++) {
      if (VALID_INTENTS.indexOf(data.intents[k]) !== -1) filtered.push(data.intents[k]);
    }
    return filtered;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
export async function classifyContent(message){
  var keywordIntents = heuristicClassifyIntent(message);
  var llmIntents = [];
  try { var _tmp = await llmClassifyIntent(message); if (Array.isArray(_tmp)) llmIntents = _tmp; } catch { llmIntents = []; }
  var merged = [];
  var seen = {};
  var all = keywordIntents.concat(llmIntents);
  for (var i2 = 0; i2 < all.length; i2++) {
    var x = all[i2];
    if (!seen[x]) { seen[x] = true; merged.push(x); }
  }
  return merged.length > 0 ? merged.join(" ") : "general";
}
