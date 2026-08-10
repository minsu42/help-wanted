/**
 * Help Wanted AI 의뢰인 Worker.
 *
 * /interpret는 플레이어의 한 문장을 허용된 ID로 구조화한다.
 * 클라이언트 규칙 엔진이 판정한 뒤 /respond는 승인된 반응만 캐릭터 대사로 바꾼다.
 * 숨은 사건 진실과 상태 쓰기 권한은 모델에 전달하지 않는다.
 */

const PROVIDERS = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const LIMITS = {
  bodyBytes: 24 * 1024,
  utterance: 240,
  response: 360,
  facts: 20,
  knowledge: 24,
  timeoutMs: 15_000,
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!cors['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403, cors);

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: Boolean(env.LLM_API_KEY), provider: providerOf(env), model: modelOf(env) }, env.LLM_API_KEY ? 200 : 503, cors);
    }
    if (request.method !== 'POST' || !['/interpret', '/respond'].includes(url.pathname)) {
      return json({ error: 'not_found' }, 404, cors);
    }
    const limited = checkRateLimit(request, env);
    if (limited) return json({ error: limited }, 429, cors);
    if (!env.LLM_API_KEY) return json({ error: 'no_api_key' }, 503, cors);

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json({ error: brief(error) || 'bad_json' }, 400, cors);
    }

    try {
      if (url.pathname === '/interpret') {
        const context = normalizeInterpret(body);
        if (!context) return json({ error: 'bad_context' }, 400, cors);
        const raw = await callModel(interpretSystem(), interpretUser(context), env, 0.15);
        const parsed = validateInterpretation(raw, context);
        return parsed ? json(parsed, 200, cors) : json({ error: 'schema_violation' }, 502, cors);
      }

      const context = normalizeRespond(body);
      if (!context) return json({ error: 'bad_context' }, 400, cors);
      const raw = await callModel(respondSystem(), respondUser(context), env, 0.72);
      const utterance = validateResponse(raw);
      return utterance ? json({ utterance }, 200, cors) : json({ error: 'schema_violation' }, 502, cors);
    } catch (error) {
      return json({ error: 'upstream_failed', detail: brief(error) }, 502, cors);
    }
  },
};

function normalizeInterpret(body) {
  if (!record(body)) return null;
  const turnId = str(body.turnId, 100);
  const utterance = str(body.utterance, LIMITS.utterance);
  const allowedSlots = list(body.allowedSlots, 5, (value) => str(value, 20));
  const allowedFacts = list(body.allowedFacts, LIMITS.facts, (item) => {
    if (!record(item)) return null;
    const id = str(item.id, 80);
    const slot = str(item.slot, 20);
    const label = str(item.label, 100);
    return id && allowedSlots.includes(slot) && label ? { id, slot, label } : null;
  });
  const visibleKnowledge = list(body.visibleKnowledge, LIMITS.knowledge, (item) => {
    if (!record(item)) return null;
    const id = str(item.id, 80);
    const title = str(item.title, 100);
    const text = str(item.text, 300);
    return id && title && text ? { id, title, text } : null;
  });
  const publicFacts = list(body.publicFacts, LIMITS.facts, (item) => {
    if (!record(item)) return null;
    const id = str(item.id, 80);
    const value = str(item.value, 200);
    return id && value ? { id, value } : null;
  });
  return turnId && utterance && allowedSlots.length > 0
    ? { turnId, utterance, allowedSlots, allowedFacts, visibleKnowledge, publicFacts }
    : null;
}

function normalizeRespond(body) {
  if (!record(body) || !record(body.persona)) return null;
  const turnId = str(body.turnId, 100);
  const persona = {
    name: str(body.persona.name, 40),
    occupation: str(body.persona.occupation, 60),
    motive: str(body.persona.motive, 180),
    demeanor: str(body.persona.demeanor, 180),
    emotion: str(body.persona.emotion, 20),
  };
  const playerUtterance = str(body.playerUtterance, LIMITS.utterance);
  const conversation = list(body.conversation, 12, (item) => {
    if (!record(item)) return null;
    const speaker = ['player', 'client', 'system'].includes(item.speaker) ? item.speaker : '';
    const text = str(item.text, 360);
    return speaker && text ? { speaker, text } : null;
  });
  const approvedReaction = str(body.approvedReaction, 360);
  const publicFacts = list(body.publicFacts, LIMITS.facts, (item) => {
    if (!record(item)) return null;
    const id = str(item.id, 80);
    const value = str(item.value, 200);
    return id && value ? { id, value } : null;
  });
  return turnId && persona.name && playerUtterance && approvedReaction
    ? { turnId, persona, playerUtterance, conversation, approvedReaction, publicFacts }
    : null;
}

function interpretSystem() {
  return [
    '너는 판타지 길드 접수 게임의 자연어 해석기다.',
    '플레이어 문장을 제공된 ID만 사용해 구조화하라. 존재하지 않는 ID를 만들지 마라.',
    '자료 지식은 문장이 그 내용이나 핵심 표지를 실제로 언급한 경우에만 citedKnowledgeIds에 넣어라.',
    '금액을 말하지 않았다면 offerAmount 키를 생략하라.',
    'JSON만 출력하라:',
    '{"intent":"ask|challenge|negotiate|accuse|reassure|other","targetSlots":[],"assertedFactIds":[],"citedKnowledgeIds":[],"tone":"supportive|neutral|hostile","confidence":0.0,"offerAmount":24}',
  ].join('\n');
}

function interpretUser(context) {
  return [
    `플레이어 문장: ${context.utterance}`,
    `허용 슬롯: ${JSON.stringify(context.allowedSlots)}`,
    `질문 대상 사실 라벨: ${JSON.stringify(context.allowedFacts)}`,
    `열람 가능한 자료: ${JSON.stringify(context.visibleKnowledge)}`,
    `이미 공개된 사실: ${JSON.stringify(context.publicFacts)}`,
  ].join('\n');
}

function respondSystem() {
  return [
    '너는 중세 판타지 길드 창구의 의뢰인을 연기한다.',
    '규칙 엔진이 승인한 반응의 의미를 바꾸지 말고 자연스러운 한국어 대사 1~2문장으로 표현하라.',
    '최근 대화와 최신 플레이어 문장에 직접 이어서 답하고, 인물의 태도와 말버릇을 유지하라.',
    '승인 반응과 공개 사실에 없는 구체적 사실, 금액, 이름, 장소를 추가하지 마라.',
    '시스템, 규칙 엔진, JSON, 도구라는 말을 하지 마라.',
    'JSON만 출력하라: {"utterance":"..."}',
  ].join('\n');
}

function respondUser(context) {
  return [
    `이름: ${context.persona.name}`,
    `직업: ${context.persona.occupation}`,
    `현재 감정: ${context.persona.emotion}`,
    `행동 동기: ${context.persona.motive}`,
    `평소 태도: ${context.persona.demeanor}`,
    `최근 대화: ${JSON.stringify(context.conversation)}`,
    `플레이어의 최신 문장: ${context.playerUtterance}`,
    `공개 사실: ${JSON.stringify(context.publicFacts)}`,
    `반드시 보존할 승인 반응: ${context.approvedReaction}`,
  ].join('\n');
}

function validateInterpretation(raw, context) {
  if (!record(raw)) return null;
  const intents = ['ask', 'challenge', 'negotiate', 'accuse', 'reassure', 'other'];
  const tones = ['supportive', 'neutral', 'hostile'];
  const intent = intents.includes(raw.intent) ? raw.intent : null;
  const tone = tones.includes(raw.tone) ? raw.tone : null;
  if (!intent || !tone) return null;
  const targetSlots = allowedArray(raw.targetSlots, context.allowedSlots);
  const assertedFactIds = allowedArray(raw.assertedFactIds, context.allowedFacts.map((item) => item.id));
  const citedKnowledgeIds = allowedArray(raw.citedKnowledgeIds, context.visibleKnowledge.map((item) => item.id));
  const confidence = finite(raw.confidence) ? clamp(raw.confidence, 0, 1) : 0;
  const result = { intent, targetSlots, assertedFactIds, citedKnowledgeIds, tone, confidence };
  if (finite(raw.offerAmount)) result.offerAmount = Math.max(0, Math.round(raw.offerAmount));
  return result;
}

function validateResponse(raw) {
  if (!record(raw)) return null;
  const utterance = str(raw.utterance, LIMITS.response);
  return utterance || null;
}

async function callModel(system, user, env, temperature) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.timeoutMs);
  try {
    const provider = providerOf(env);
    const generation = provider === 'openai'
      ? { max_completion_tokens: 500, reasoning_effort: 'none' }
      : { max_tokens: 500, temperature };
    const response = await fetch(PROVIDERS[provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: modelOf(env), ...generation,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream_${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('no_content');
    return JSON.parse(stripFence(content));
  } finally {
    clearTimeout(timer);
  }
}

function providerOf(env) {
  const provider = String(env.PROVIDER || 'openai').toLowerCase();
  return Object.hasOwn(PROVIDERS, provider) ? provider : 'openai';
}

function modelOf(env) {
  return env.MODEL || 'gpt-5.6-luna';
}

async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length') || '0');
  if (declared > LIMITS.bodyBytes) throw new Error('body_too_large');
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) throw new Error('body_too_large');
  return JSON.parse(text);
}

const buckets = new Map();
let dailyCount = 0;
let dailyStamp = '';

function checkRateLimit(request, env) {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dailyStamp) { dailyStamp = today; dailyCount = 0; }
  const dailyCap = positive(env.DAILY_CALL_CAP, 3000);
  if (dailyCount >= dailyCap) return 'daily_cap_reached';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hits = (buckets.get(ip) || []).filter((time) => now - time < 60_000);
  if (hits.length >= positive(env.RATE_LIMIT_PER_MINUTE, 30)) return 'rate_limited';
  hits.push(now);
  buckets.set(ip, hits);
  dailyCount += 1;
  return null;
}

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin) || allowed.includes('*')) headers['Access-Control-Allow-Origin'] = origin || '*';
  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function list(value, max, mapper) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map(mapper).filter(Boolean);
}

function allowedArray(value, allowed) {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return [...new Set(value.filter((item) => typeof item === 'string' && set.has(item)))];
}

function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function str(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function brief(error) { return String(error?.message || error).slice(0, 160); }
function stripFence(value) { return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim(); }
