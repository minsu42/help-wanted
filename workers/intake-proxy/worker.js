/**
 * 청취 프록시 Worker — ADR-003의 D2·D5·D6·D8을 그대로 코드로 옮긴 것이다.
 *
 * ```
 * GitHub Pages (게임 본체)  ──fetch──▶  이 Worker  ──▶ NVIDIA NIM (1순위)
 *                                                  └─▶ OpenAI      (예비)
 * ```
 *
 * ## 이것은 범용 중계가 아니다 (D2)
 *
 * 클라이언트가 프롬프트를 보내지 않는다. 보내는 것은 **구조화된 턴 컨텍스트**
 * (직업·후보 목록·단서 목록·최근 대화)뿐이고, 의뢰인 페르소나 시스템 프롬프트는
 * 이 파일이 소유한다. 모델 이름도 클라이언트가 고르지 못한다 — 환경 변수다.
 * 그래서 이 엔드포인트를 퍼가도 범용 LLM API로 쓸 수 없다.
 *
 * ## LLM은 게임 상태에 닿지 못한다 (D3·D6)
 *
 * 응답의 `options[]`에 실린 id가 **우리가 이번 요청에 실어 보낸 id 집합** 안에
 * 없으면 버린다. 클라이언트도 같은 검증을 한 번 더 한다 (`src/llm/gateway.ts`).
 * 두 겹인 이유는 어느 한쪽만 고쳐도 뚫리지 않게 하기 위해서다.
 *
 * 그리고 프롬프트에는 **공개가 허가된 것만** 싣는다. 후보는 `topic`(물어볼 거리의
 * 이름)이지 `fact`(내용)가 아니다 — 프로토 3회차가 이것을 어겨 의뢰인이 묻지도
 * 않은 사실을 먼저 말했다 (`prototypes/flow-intake/README.md` ①).
 *
 * ## 의존성 0 (D8)
 *
 * `fetch` 하나로 끝난다. OpenAI SDK도 NIM SDK도 쓰지 않는다.
 *
 * ## 배포
 *
 * `workers/intake-proxy/README.md` 참조. 키는 `wrangler secret put LLM_API_KEY`로만
 * 들어간다 — 이 저장소에 키가 들어가는 경로는 존재하지 않는다.
 */

/** 공급자별 chat completions 엔드포인트. 둘 다 OpenAI 호환 포맷이라 본문이 같다. */
const PROVIDER_ENDPOINTS = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

/** 요청 본문 상한 — 대화 이력이 무한히 자라는 요청을 입구에서 막는다. */
const LIMITS = {
  bodyBytes: 16 * 1024,
  candidates: 12,
  clues: 12,
  history: 12,
  textChars: 400,
  sayChars: 400,
  options: 3,
  upstreamTimeoutMs: 15000,
};

/**
 * 직업별 페르소나. **Worker가 소유한다** — 클라이언트에 내려가지 않는다 (D2).
 * 어휘는 `src/data/text.json`의 성격 축과 별개다. 여기는 "어떻게 말하는가"만 담는다.
 */
const PERSONA = {
  주민: '가난한 마을 주민. 겁이 많고 말이 짧다. 존댓말이 서툴다.',
  상인: '셈이 빠른 장사꾼. 손해를 싫어하고 값 이야기를 자주 꺼낸다.',
  관리: '지방 관리. 절차와 기록 뒤에 선다. 문어체에 가깝다.',
  귀족: '몰락해 가는 귀족. 에두르고 체면을 신경 쓴다.',
  갱단: '뒷골목 사람. 말이 짧고 눈을 피하지 않는다. 협박은 하지 않는다.',
};

/** 알 수 없는 직업이 와도 500을 내지 않는다 — 연기는 실패해도 게임은 굴러야 한다. */
const PERSONA_DEFAULT = '창구에 찾아온 의뢰인. 불안해서 말이 많다.';

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   */
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (!cors['Access-Control-Allow-Origin']) {
      // 허용 목록 밖의 출처. 브라우저는 어차피 못 읽지만 상류 호출을 아끼는 것이 요점이다.
      return json({ error: 'origin_not_allowed' }, 403, cors);
    }

    const url = new URL(request.url);

    // 기동 시 헬스체크 (D5) — 프록시가 죽어 있으면 게임이 폴백 모드로 시작한다.
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(
        { ok: true, provider: providerOf(env), model: modelOf(env) },
        200,
        cors,
      );
    }

    if (request.method !== 'POST' || url.pathname !== '/turn') {
      return json({ error: 'not_found' }, 404, cors);
    }

    const limited = checkRateLimit(request, env);
    if (limited) return json({ error: limited }, 429, cors);

    let body;
    try {
      body = await readJson(request);
    } catch (err) {
      return json({ error: String(err && err.message) || 'bad_request' }, 400, cors);
    }

    const ctx = normalizeContext(body);
    if (!ctx) return json({ error: 'bad_context' }, 400, cors);

    if (!env.LLM_API_KEY) {
      // 시크릿을 안 넣은 배포. 클라이언트는 폴백으로 떨어지면 되므로 502가 정답이다.
      return json({ error: 'no_api_key' }, 502, cors);
    }

    let raw;
    try {
      raw = await callProvider(ctx, env);
    } catch (err) {
      return json({ error: 'upstream_failed', detail: brief(err) }, 502, cors);
    }

    const turn = validateTurn(raw, ctx);
    if (!turn) return json({ error: 'schema_violation' }, 502, cors);

    return json(turn, 200, cors);
  },
};

/* ─────────────────────────── 요청 해석 ─────────────────────────── */

/** 본문을 읽되 크기를 먼저 본다 — 큰 본문으로 상류 토큰을 태우는 것이 가장 싼 남용이다. */
async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length') || '0');
  if (declared > LIMITS.bodyBytes) throw new Error('body_too_large');
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) throw new Error('body_too_large');
  return JSON.parse(text);
}

/**
 * 클라이언트가 보낸 턴 컨텍스트를 신뢰하지 않고 다시 깎는다.
 * 여기를 통과한 모양만 프롬프트에 실린다.
 */
function normalizeContext(body) {
  if (!body || typeof body !== 'object') return null;

  const occupation = str(body.occupation, 20);
  const candidates = list(body.candidates, LIMITS.candidates, (c) => {
    const id = str(c && c.id, 60);
    const topic = str(c && c.topic, 80);
    return id && topic ? { id, topic } : null;
  });
  const clues = list(body.clues, LIMITS.clues, (c) => {
    const id = str(c && c.id, 60);
    const text = str(c && c.text, LIMITS.textChars);
    return id && text ? { id, text } : null;
  });
  const history = list(body.history, LIMITS.history, (h) => {
    const who = str(h && h.who, 20);
    const text = str(h && h.text, LIMITS.textChars);
    return who && text ? { who, text } : null;
  });

  return {
    occupation: occupation || '주민',
    // `saidFact`는 **방금 판정으로 공개가 허가된 내용** 하나뿐이다 (D6).
    saidFact: str(body.saidFact, LIMITS.textChars),
    mood: str(body.mood, 80),
    candidates,
    clues,
    history,
  };
}

function str(value, max) {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

function list(value, max, map) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value.slice(0, max)) {
    const mapped = map(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

/* ─────────────────────────── 남용 방어 ─────────────────────────── */

/**
 * IP당 레이트 리밋 + 일일 총량 캡 (D2).
 *
 * ⚠ **격리(isolate) 단위 best-effort다.** Worker 인스턴스가 여러 개 뜨면 각자
 * 세는 것이므로 실제 상한은 이 값의 배수가 될 수 있다. 정확한 상한이 필요해지면
 * KV나 Durable Object를 붙여야 하고, 그것은 상태를 가진 인프라를 들이는
 * **결정**이라 여기서 임의로 하지 않았다 (ADR-003은 Worker를 무상태로 유지한다고
 * 적었다). 무료 크레딧 기반이라 남용의 피해가 돈이 아니라 쿼터로 한정된다는
 * 전제 위에서, 지금은 이 정도가 값과 효과의 균형점이다.
 */
const buckets = new Map();
let dailyCount = 0;
let dailyStamp = '';

function checkRateLimit(request, env) {
  const perMinute = num(env.RATE_LIMIT_PER_MINUTE, 20);
  const perDay = num(env.DAILY_CALL_CAP, 3000);
  const now = Date.now();

  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dailyStamp) {
    dailyStamp = today;
    dailyCount = 0;
  }
  if (dailyCount >= perDay) return 'daily_cap_reached';

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = 60_000;
  const hits = (buckets.get(ip) || []).filter((t) => now - t < window);
  if (hits.length >= perMinute) {
    buckets.set(ip, hits);
    return 'rate_limited';
  }
  hits.push(now);
  buckets.set(ip, hits);
  dailyCount += 1;

  // 오래된 키가 무한히 쌓이지 않게 가끔 쓸어낸다.
  if (buckets.size > 500) {
    for (const [key, times] of buckets) {
      if (!times.some((t) => now - t < window)) buckets.delete(key);
    }
  }
  return null;
}

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/* ─────────────────────────── 프롬프트 ─────────────────────────── */

/**
 * 시스템 프롬프트. 프로토 3회차에서 **실측으로 다듬어진 문안**이다 —
 * 역할 혼동(의뢰인이 길드마스터에게 되묻는다)은 암시로 막히지 않고 나쁜 예·좋은
 * 예를 같이 줘야 막혔다 (GDD R11이 같은 것을 기록하고 있다).
 */
function systemPrompt(ctx) {
  const persona = PERSONA[ctx.occupation] || PERSONA_DEFAULT;
  return [
    `너는 판타지 세계 길드 접수창구에 온 의뢰인을 연기한다. 직업: ${ctx.occupation}. ${persona}`,
    '규칙:',
    '1) 한국어. 의뢰인의 대사는 **최대 2문장, 60자 이내**. 짧게. 자연스러운 구어체.',
    '2) **"방금 밝혀진 사실" 외의 구체적 사실(색·수·이름·장소)을 절대 말하지 마라.**',
    '   후보 목록은 화제의 **이름**일 뿐이다. 아직 밝혀지지 않았으므로 그 내용을 말하거나',
    '   추측하거나 선택지 문장 안에 담으면 안 된다. 선택지는 **묻는 말**이어야 한다.',
    '3) 너는 대화를 **멈추지 않는다** — 하던 말을 잇거나, 불안을 덧붙이거나, 부탁을 되풀이한다.',
    '',
    '★ 역할을 절대 섞지 마라:',
    '   - "say"  = **의뢰인 자신의 말.** 도움을 청하러 온 사람이다.',
    '     **후보 목록을 궁금해하면 안 된다** — 그건 의뢰인이 이미 겪은 일이지 궁금한 게 아니다.',
    '     (나쁜 예) "발자국의 생김새가 궁금합니다"  ← 의뢰인이 물으면 안 된다',
    '     (좋은 예) "그날 이후로 밤에 밖에 못 나갑니다. 부디 좀 봐 주십시오."',
    '   - "options" = **길드마스터(플레이어)가 의뢰인에게 할 말.** 여기가 묻는 쪽이다.',
    '     각각 완결된 문장. 키워드 금지. 주어진 후보의 id를 반드시 붙인다.',
    '4) 후보가 비면 options는 빈 배열로 둔다.',
    'JSON만 출력: {"say": "...", "options": [{"text": "...", "nodeId": "..."}]}',
    '단서를 들이대는 선택지는 nodeId 대신 {"text":"...","clueId":"..."}로 낸다.',
  ].join('\n');
}

function userPrompt(ctx) {
  return [
    ctx.saidFact
      ? `방금 밝혀진 사실(이 내용만 말할 것): ${ctx.saidFact}`
      : '아직 아무것도 캐묻지 않았다.',
    ctx.mood ? `분위기 지시: ${ctx.mood}` : '',
    '',
    '플레이어가 지금 물을 수 있는 것(후보) — **이것은 화제의 이름일 뿐 내용이 아니다.**',
    '**후보의 내용을 네가 지어내서 말하지 마라. 질문거리만 만들어라.**',
    ...(ctx.candidates.length
      ? ctx.candidates.map((c) => `- id=${c.id} : ${c.topic}`)
      : ['- (없음)']),
    '',
    '플레이어가 들이댈 수 있는 것(단서):',
    ...(ctx.clues.length ? ctx.clues.map((c) => `- id=${c.id} : ${c.text}`) : ['- (없음)']),
    '',
    '최근 대화:',
    ...ctx.history.map((h) => `${h.who}: ${h.text}`),
  ].join('\n');
}

/* ─────────────────────────── 상류 호출 ─────────────────────────── */

function providerOf(env) {
  const name = (env.PROVIDER || 'nvidia').toLowerCase();
  return PROVIDER_ENDPOINTS[name] ? name : 'nvidia';
}

function modelOf(env) {
  return env.MODEL || 'meta/llama-3.1-70b-instruct';
}

async function callProvider(ctx, env) {
  const provider = providerOf(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.upstreamTimeoutMs);

  try {
    const res = await fetch(PROVIDER_ENDPOINTS[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelOf(env),
        temperature: num(env.TEMPERATURE, 0.9),
        max_tokens: num(env.MAX_TOKENS, 500),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(ctx) },
          { role: 'user', content: userPrompt(ctx) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('no_content');
    return JSON.parse(stripCodeFence(content));
  } finally {
    clearTimeout(timer);
  }
}

/** `response_format`을 지원하지 않는 모델이 ```json 울타리를 씌워 보내는 경우가 있다. */
function stripCodeFence(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
}

/* ─────────────────────────── 응답 검증 ─────────────────────────── */

/**
 * 우리가 준 id 밖의 것은 버린다 — 여기가 D3(LLM이 상태에 닿지 못한다)의 실물이다.
 * 대사는 길이만 본다 (D6: 말투가 이상한 것은 감수한다, 상태만 안 더럽히면 된다).
 */
function validateTurn(raw, ctx) {
  if (!raw || typeof raw !== 'object') return null;
  const say = str(raw.say, LIMITS.sayChars);
  if (!say) return null;

  const okNode = new Set(ctx.candidates.map((c) => c.id));
  const okClue = new Set(ctx.clues.map((c) => c.id));

  const options = (Array.isArray(raw.options) ? raw.options : [])
    .map((o) => {
      const text = str(o && o.text, LIMITS.textChars);
      if (!text) return null;
      const nodeId = str(o && o.nodeId, 60);
      const clueId = str(o && o.clueId, 60);
      if (nodeId && okNode.has(nodeId)) return { text, nodeId };
      if (clueId && okClue.has(clueId)) return { text, clueId };
      return null;
    })
    .filter(Boolean)
    .slice(0, LIMITS.options);

  return { say, options };
}

/* ─────────────────────────── HTTP 잡일 ─────────────────────────── */

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin) || allowed.includes('*')) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }
  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function brief(err) {
  return String((err && err.message) || err).slice(0, 200);
}
