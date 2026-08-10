/* 프로토 3 전용 LLM 래퍼 — 소관은 **생성 하나뿐**이다.
   분류(파싱)를 하지 않는다. 플레이어의 자유 텍스트를 해석하는 경로가 없으므로
   Portopia형 실패("무엇이든 통한다는 못 지킬 약속")가 구조적으로 불가능하다.

   한 턴에 한 번 호출해 두 가지를 같이 받는다:
     ① 의뢰인의 다음 대사   ② 플레이어가 지금 할 수 있는 말 2~3개
   선택지에는 반드시 우리가 준 후보 id가 붙어 나온다 — 판정은 규칙 엔진이 한다. */

const LLM_OK = !!(window.PROTO_CONFIG && window.PROTO_CONFIG.apiKey
  && !window.PROTO_CONFIG.apiKey.startsWith('sk-...'));

async function chat(messages, { json = true, max = 500 } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               Authorization: 'Bearer ' + window.PROTO_CONFIG.apiKey },
    body: JSON.stringify({
      model: window.PROTO_CONFIG.model, messages, temperature: 0.9, max_tokens: max,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error('LLM ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return JSON.parse((await res.json()).choices[0].message.content);
}

const PERSONA = {
  '주민': '가난한 마을 주민. 겁이 많고 말이 짧다. 존댓말이 서툴다.',
  '상인': '셈이 빠른 장사꾼. 손해를 싫어하고 값 이야기를 자주 꺼낸다.',
  '관리': '지방 관리. 절차와 기록 뒤에 선다. 문어체에 가깝다.',
  '귀족': '몰락해 가는 귀족. 에두르고 체면을 신경 쓴다.',
  '갱단': '뒷골목 사람. 말이 짧고 눈을 피하지 않는다. 협박은 하지 않는다.',
};

/**
 * @param ctx {{occ, history, saidFact, candidates, clues, mood}}
 *   candidates: [{id, hint}]  — 플레이어가 지금 물을 수 있는 것 (열린 가장자리)
 *   clues:      [{id, text}]  — 게이트에 들이댈 수 있는 것 (이미 아는 것)
 * @returns {{say, options:[{text, nodeId?, clueId?}]}}
 */
async function turn(ctx) {
  const sys = [
    `너는 판타지 세계 길드 접수창구에 온 의뢰인을 연기한다. 직업: ${ctx.occ}. ${PERSONA[ctx.occ]}`,
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

  const user = [
    ctx.saidFact ? `방금 밝혀진 사실(이 내용만 말할 것): ${ctx.saidFact}` : '아직 아무것도 캐묻지 않았다.',
    ctx.mood ? `분위기 지시: ${ctx.mood}` : '',
    '',
    '플레이어가 지금 물을 수 있는 것(후보) — **이것은 화제의 이름일 뿐 내용이 아니다.**',
    '**후보의 내용을 네가 지어내서 말하지 마라. 질문거리만 만들어라.**',
    ...(ctx.candidates.length ? ctx.candidates.map(c => `- id=${c.id} : ${c.hint}`) : ['- (없음)']),
    '',
    '플레이어가 들이댈 수 있는 것(단서):',
    ...(ctx.clues.length ? ctx.clues.map(c => `- id=${c.id} : ${c.text}`) : ['- (없음)']),
    '',
    '최근 대화:',
    ...ctx.history.slice(-8).map(h => `${h.who}: ${h.text}`),
  ].join('\n');

  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }]);
  window.__lastRaw = { user, out };   // 디버그용

  // 스키마 검증 — 우리가 준 id 밖의 것은 버린다 (LLM이 상태에 닿지 못하게)
  const okNode = new Set(ctx.candidates.map(c => c.id));
  const okClue = new Set(ctx.clues.map(c => c.id));
  const options = (Array.isArray(out.options) ? out.options : [])
    .filter(o => o && typeof o.text === 'string'
      && ((o.nodeId && okNode.has(o.nodeId)) || (o.clueId && okClue.has(o.clueId))))
    .slice(0, 3);
  return { say: String(out.say || '').slice(0, 400), options };
}

window.LLM = { ok: LLM_OK, turn };
