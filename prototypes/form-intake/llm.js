/* 프로토 4 LLM 래퍼 — 소관은 **생성 둘**뿐이다.
     ① 의뢰인의 대사   ② **플레이어의 대사** (행동을 문장으로)
   분류(파싱)를 하지 않는다. 자유 텍스트를 해석하는 경로가 없으므로
   Portopia형 실패가 구조적으로 불가능하다 (GDD R11).

   ⚠ 미공개 칸은 `topic`(물어볼 거리의 이름)으로만 넘긴다. `fact`를 주면
   연기자가 묻기도 전에 답을 말한다 — 프로토 3회차의 실측 (ADR-003 D6). */

const LLM_OK = !!(window.PROTO_CONFIG && window.PROTO_CONFIG.apiKey
  && !window.PROTO_CONFIG.apiKey.startsWith('sk-...'));

async function chat(messages, max = 400) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               Authorization: 'Bearer ' + window.PROTO_CONFIG.apiKey },
    body: JSON.stringify({ model: window.PROTO_CONFIG.model, messages,
      temperature: 0.9, max_tokens: max, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) throw new Error('LLM ' + res.status);
  return JSON.parse((await res.json()).choices[0].message.content);
}

const PERSONA = {
  '주민': '가난한 마을 주민. 겁이 많고 말이 짧다.',
  '상인': '셈이 빠른 장사꾼. 손해를 싫어하고 값 이야기를 자주 꺼낸다.',
  '관리': '지방 관리. 절차와 기록 뒤에 선다. 문어체에 가깝다.',
  '귀족': '몰락해 가는 귀족. 에두르고 체면을 신경 쓴다.',
  '갱단': '뒷골목 사람. 말이 짧고 눈을 피하지 않는다.',
};

const OUTCOME = {
  told:   '의뢰인이 순순히 말한다. **주어진 「밝혀진 사실」만** 말한다.',
  unknown:'의뢰인이 정말 모른다. 미안해하거나 머쓱해한다. **어떤 새 사실도 말하지 마라.**',
  evade:  '의뢰인이 알면서 피한다. **무엇을 숨기는지는 절대 말하지 마라.** 화제를 돌리거나 짧게 자른다.',
  hintFail:'건네받은 이야기가 자기 일과 이어지지 않는다. 여전히 모른다. **새 사실을 말하지 마라.**',
  leverFail:'들이댄 이야기가 자기 아픈 곳이 아니다. 담담히 넘긴다. **새 사실을 말하지 마라.**',
  skip:   '길드마스터가 그 칸을 비우고 넘어간다. 의뢰인은 조금 불안해한다.',
};

const VERB = {
  ask:   '그 칸의 내용을 묻는다',
  press: '이미 들은 것보다 더 자세히 캐묻는다',
  hint:  '자기가 아는 이야기를 **건네주어 기억을 일깨우려 한다**',
  lever: '자기가 아는 이야기를 **꺼내 지목하며 압박한다** (무례하지 않게, 직업인으로서)',
  skip:  '그 칸을 비워 두고 넘어간다고 말한다',
};

/**
 * @param ctx {{occ, verb, topic, material?, outcome, revealed?, history}}
 * @returns {{me:string, them:string}}
 */
async function turn(ctx) {
  const sys = [
    `길드 접수창구 장면을 쓴다. 의뢰인 직업: ${ctx.occ}. ${PERSONA[ctx.occ]}`,
    '두 사람의 대사를 하나씩 쓴다. 한국어, 각각 **최대 2문장·70자 이내**.',
    '',
    '★ 역할을 절대 섞지 마라:',
    '  - "me"   = **길드마스터(플레이어)의 말.** 서류를 채우려는 접수원이다. 묻는 쪽.',
    '  - "them" = **의뢰인의 말.** 도움을 청하러 온 사람이다. 답하는 쪽.',
    '    (나쁜 예) 의뢰인이 "그 생김새가 궁금합니다" ← 의뢰인은 이미 겪은 사람이다',
    '',
    '★ 절대 규칙 ①: **「밝혀진 사실」로 주어진 것 외의 구체적 사실(색·수·이름·장소·현상)을',
    '  지어내지 마라.** 「화제」는 물어볼 거리의 **이름일 뿐 내용이 아니다.**',
    '  「밝혀진 사실」이 없으면 **의뢰인은 어떤 새 사실도 말하지 않는다.** 모른다/피한다만 한다.',
    '  (나쁜 예) 모른다면서 "소리는 들었습니다" ← 새 사실이다. 금지.',
    '',
    '★ 절대 규칙 ②: 「길드마스터가 꺼낸 이야기」가 주어지면 **"me"는 반드시 그 이야기를',
    '  자기 입으로 말해야 한다.** 다른 질문으로 바꾸지 마라.',
    '  (좋은 예) "제가 알기로 트롤은 발가락이 셋이라고 합니다만."',
    '',
    'JSON만 출력: {"me": "...", "them": "..."}',
  ].join('\n');

  const user = [
    `길드마스터가 하려는 것: ${VERB[ctx.verb]}`,
    `화제(내용이 아니라 이름): ${ctx.topic || '(없음)'}`,
    ctx.material ? `길드마스터가 꺼낸 이야기: "${ctx.material}"` : '',
    `의뢰인의 반응: ${OUTCOME[ctx.outcome]}`,
    ctx.revealed ? `밝혀진 사실(이 내용만 말할 것): ${ctx.revealed}` : '',
    '',
    '최근 대화:',
    ...(ctx.history.slice(-6).map(h => `${h.who}: ${h.text}`) || []),
  ].filter(Boolean).join('\n');

  const out = await chat([{ role:'system', content: sys }, { role:'user', content: user }]);
  window.__lastRaw = { user, out };
  return { me: String(out.me || '').slice(0, 200), them: String(out.them || '').slice(0, 200) };
}

window.LLM = { ok: LLM_OK, turn };
