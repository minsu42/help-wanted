// 프로토 A/B 본체. 버리는 코드 — 전역·하드코딩 허용.
/* global CASE, classifyA, classifyB, actMarta, readCommission */

const _m = new URLSearchParams(location.search).get("mode");
const MODE = _m === "b" ? "B" : _m === "c" ? "C" : "A";
const BUDGET = 8;
const LV = { 0: "미상", 1: "모호", 2: "확정" };

const state = {
  budget: BUDGET,
  ended: false,
  // A
  slotState: { 종류: 1, 대상: 0, 규모: 0, 장소: 0 }, // R2: 종류는 모호로 시작
  blocked: {}, // slot -> '무지'|'은폐' (한계에 부딪힌 기록)
  // B
  gauge: CASE.gaugeStart,
  smalltalkUsed: false,
  unlocked: new Set(["f1"]), // f1(threshold 0)은 첫 하소연으로 이미 공개
  // C
  cVisited: new Set(["start"]),
  cTranscript: [], // {label, text, cue?}
  cSlotFill: {},   // slot name -> {level, text}
  cMemos: [],
  // 보수 흥정 (모든 모드 공용)
  fee: null,
  feeAgreed: false,
};

// 마르타의 숨은 지갑 — 규칙이 소유한다. LLM은 결과를 연기만 한다.
const MARTA_WALLET = { cap: 35, easy: 25, counter: 30 };

const $ = (id) => document.getElementById(id);
const log = $("log");

function addBubble(who, text, cls) {
  const div = document.createElement("div");
  div.className = "bubble " + (cls || who);
  div.innerHTML = "<b>" + (who === "player" ? "나" : who === "marta" ? "마르타" : "") + "</b>" + escapeHtml(text);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
function addNote(text) {
  const div = document.createElement("div");
  div.className = "note";
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
}

// ---------- 사이드 패널 ----------

function renderPanel() {
  $("budget").textContent = state.budget;
  if (MODE === "C") {
    // 청취 중에는 슬롯을 보여주지 않는다 — 슬롯은 메뉴가 아니라 보상이다.
    let html = "";
    if (state.cTranscript.length === 0) {
      html = `<div class="frag closed">아직 들은 것이 없다.</div>`;
    }
    for (const e of state.cTranscript) {
      html += `<div class="frag ${e.cue ? "closed" : "open"}">` +
        (e.cue ? "✎ " + e.text : "✒ <b>" + e.label + "</b> — " + e.text) + `</div>`;
    }
    $("panel-body").innerHTML = html;
    return;
  }
  if (MODE === "A") {
    let html = "";
    for (const slot of ["종류", "대상", "규모", "장소"]) {
      const lv = state.slotState[slot];
      const blocked = state.blocked[slot];
      html += `<div class="slot lv${lv}"><span class="slot-name">${slot}</span>` +
        `<span class="slot-state">${LV[lv]}${blocked ? " · 막힘(" + blocked + ")" : ""}</span></div>`;
    }
    $("panel-body").innerHTML = html;
  } else {
    const mood = CASE.moodLabels.find((m) => state.gauge >= m.min).label;
    let html = `<div class="mood">${mood}</div>`;
    html += `<div class="frag-list">`;
    for (const f of CASE.fragments) {
      html += `<div class="frag ${state.unlocked.has(f.id) ? "open" : "closed"}">` +
        (state.unlocked.has(f.id) ? "✒ " + f.text : "▢ (아직 듣지 못한 이야기)") + `</div>`;
    }
    html += `</div>`;
    $("panel-body").innerHTML = html;
  }
}

// ---------- 프로토 A: 슬롯 × 깊이 ----------

async function turnA(text) {
  const cls = await classifyA(text);
  if (cls.slot === "없음") {
    addNote("의뢰와 무관한 말 — 행동 칸을 쓰지 않았다");
    const line = await actMarta("길드마스터의 말이 의뢰와 무관했다. 어리둥절하지만 공손하게, 짐승 이야기로 돌아가고 싶어 하며 짧게 답해라. 새 정보는 주지 마라.", text);
    addBubble("marta", line);
    return;
  }

  let depth = cls.depth === "certain" ? 2 : 1;
  let demoted = false;
  if (depth === 2 && state.slotState[cls.slot] === 0) { // C안: 미상 슬롯에 날카 질문 → 뭉툭 강등
    depth = 1;
    demoted = true;
  }

  const def = CASE.slots[cls.slot];
  const reach = Math.min(def.knows, def.tells, depth);
  const cur = state.slotState[cls.slot];
  const isRequestion = reach <= cur;

  state.budget -= 1; // 성립한 질문은 칸을 쓴다

  let limiter = null;
  if (reach < 2) {
    if (depth <= def.knows && depth <= def.tells) limiter = "질문";
    else if (def.knows <= def.tells) limiter = "무지";
    else limiter = "은폐";
  }

  let tag = `[${cls.slot} · ${cls.depth === "certain" ? "날카로움" : "뭉툭함"}${demoted ? " → 뭉툭 강등" : ""}]`;
  if (isRequestion) {
    if (limiter && limiter !== "질문") state.blocked[cls.slot] = limiter;
    addNote(tag + " 더 나아가지 못했다 — 한계: " + (limiter || "이미 확정") );
    const directive =
      limiter === "무지"
        ? `길드마스터가 '${cls.slot}'을(를) 캐물었지만 너는 정말 거기까지 모른다. 미안해하며 모른다고 답해라. 아는 척 지어내지 마라.`
        : limiter === "은폐"
        ? `길드마스터가 '${cls.slot}'을(를) 캐물었다. 너는 더 아는 게 있지만(아들 얀이 봤다) 아이가 혼날까 봐 절대 말하지 않기로 했다. ` +
          `질문받은 사실 자체(색·크기·생김새 등)에 대해 어떤 묘사도 추측도 하지 마라 — "모르겠다", "직접 못 봐서" 라고만 하고 어색하게 화제를 돌려라. 아들 이야기를 꺼내지 마라.`
        : `길드마스터가 이미 들은 것을 또 물었다. 이미 말씀드렸다는 뉘앙스로, 같은 내용을 더 짧게 반복해라: "${def.truth[Math.min(cur, 2)] || "딱히 더 아는 게 없다"}"`;
    const line = await actMarta(directive, text);
    addBubble("marta", line);
  } else {
    state.slotState[cls.slot] = reach;
    addNote(tag + ` ${cls.slot}: ${LV[cur]} → ${LV[reach]}` + (limiter && reach < 2 ? ` (한계: ${limiter})` : ""));
    const directive =
      `길드마스터의 질문에 답해서 다음 사실을 자연스럽게 전달해라: "${def.truth[reach]}". ` +
      (limiter === "은폐" ? "그 이상은 알지만 숨겨라. 아들 이야기는 절대 꺼내지 마라. " : "") +
      (limiter === "무지" ? "그 이상은 정말 모른다는 티를 내라. " : "") +
      (limiter === "질문" ? "더 아는 게 있는 눈치지만, 물은 만큼만 답해라. " : "");
    const line = await actMarta(directive, text);
    addBubble("marta", line);
  }
}

// ---------- 프로토 B: 신뢰 게이지 × 화법 ----------

async function turnB(text) {
  const cls = await classifyB(text);
  state.budget -= 1; // B는 모든 발화가 칸을 쓴다 (잡담 포함 — 시간은 흐른다)

  let delta = CASE.toneDeltas[cls.tone] || 0;
  if (cls.tone === "잡담") {
    delta = state.smalltalkUsed ? 0 : 1;
    state.smalltalkUsed = true;
  }
  const before = state.gauge;
  state.gauge = Math.max(0, Math.min(CASE.gaugeMax, state.gauge + delta));

  // 이 발화의 주제 + 현재 게이지로 열리는 조각
  const newlyOpen = [];
  let refusedFrag = null;
  for (const f of CASE.fragments) {
    if (state.unlocked.has(f.id)) continue;
    const topicHit = f.topic === cls.topic || (f.topic === "아들" && cls.topic === "대상" && state.gauge >= f.threshold);
    if (!topicHit) continue;
    if (state.gauge >= f.threshold) {
      state.unlocked.add(f.id);
      newlyOpen.push(f);
    } else if (!refusedFrag) {
      refusedFrag = f;
    }
  }

  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "―";
  addNote(`[${cls.tone} · 주제: ${cls.topic}] 마음 ${arrow}${Math.abs(delta)} (${before} → ${state.gauge})`);

  let directive;
  if (newlyOpen.length > 0) {
    directive =
      `마음이 열렸다. 길드마스터의 말에 반응하며 다음 사실을 자연스럽게 털어놓아라: ` +
      newlyOpen.map((f) => `"${f.text}"`).join(" 그리고 ") +
      (newlyOpen.some((f) => f.id === "f5") ? " (아들 이야기는 큰맘 먹고 꺼내는 것이다 — 망설임을 담아라.)" : "");
  } else if (refusedFrag) {
    directive =
      cls.tone === "압박" || cls.tone === "위협"
        ? "길드마스터의 말투에 겁을 먹었다. 몸을 움츠리고 대답을 얼버무려라. 새 정보를 주지 마라. 말이 짧아진다."
        : "그 주제에 대해 아직 마음을 다 열지 못했다. 대답은 하되 겉돌게, 구체적인 것은 피하면서. 새 정보를 주지 마라.";
  } else if (cls.tone === "잡담" || cls.topic === "없음") {
    directive = "의뢰와 무관한 한담이다. 성격대로 짧게 응대해라. 새 정보는 주지 마라." +
      (delta > 0 ? " 조금 긴장이 풀렸다." : "");
  } else {
    directive = "이미 말한 주제를 또 물었다. 이미 말씀드린 내용이라는 뉘앙스로 짧게 반복해라. 새 정보는 주지 마라.";
  }
  const line = await actMarta(directive, text);
  addBubble("marta", line);
}

// ---------- 프로토 C: 단서 그물 ----------

function cReachable() {
  return CASE_C.nodes.filter(
    (n) => !state.cVisited.has(n.id) && n.parents.some((p) => state.cVisited.has(p))
  );
}

async function turnC(text) {
  const reachable = cReachable();
  const visited = CASE_C.nodes.filter((n) => state.cVisited.has(n.id));
  const cls = await classifyC(text, reachable, visited);

  if (cls.nodeId === "없음") {
    addNote("대화에 없는 것을 겨냥했다 — 행동 칸을 쓰지 않았다");
    const line = await actMarta(
      "길드마스터의 말이 지금까지의 대화에 없던 것을 물었거나 의뢰와 무관했다. 어리둥절해하며 아는 이야기(숲의 짐승)로 돌아가고 싶어 해라. 새로운 사실은 절대 말하지 마라.",
      text
    );
    addBubble("marta", line);
    return;
  }

  const node = CASE_C.nodes.find((n) => n.id === cls.nodeId);

  // 재질문 — 이미 다룬 주제
  if (state.cVisited.has(node.id)) {
    state.budget -= 1;
    addNote(`[${node.label} · 재질문] 새로 나온 것은 없다`);
    const line = await actMarta(
      `길드마스터가 이미 말한 주제('${node.label}')를 또 물었다. 이미 말씀드렸다는 뉘앙스로 같은 내용을 더 짧게 반복해라: "${node.content}". 새로운 사실은 덧붙이지 마라.`,
      text
    );
    addBubble("marta", line);
    return;
  }

  // 잠긴 문 — 화법이 판정되는 유일한 지점
  if (node.gated) {
    state.budget -= 1;
    if (cls.tone === "공감") {
      await openNode(node, text, "큰맘 먹고 털어놓는 것이다 — 망설임과 안도를 같이 담아라.");
      return;
    }
    addNote(`[${node.label} · ${cls.tone}] 마르타가 다시 닫혔다 — 다그쳐서는 열리지 않는다`);
    const directive =
      cls.tone === "압박" || cls.tone === "위협"
        ? "길드마스터가 다그쳤다. 겁을 먹고 방어적으로 움츠러들어라. \"아무것도 아니에요\" 같은 부정. 숨기는 것(아들)은 절대 말하지 마라."
        : "길드마스터가 파고들었지만 너는 아직 마음을 못 정했다. 얼버무리며 화제를 돌려라. 숨기는 것(아들)은 절대 말하지 마라.";
    const line = await actMarta(directive, text);
    addBubble("marta", line);
    addNote("✎ 마르타는 여전히 무언가를 삼키고 있다.");
    return;
  }

  state.budget -= 1;
  await openNode(node, text, node.actNote || "");
}

async function openNode(node, playerLine, extraDirective) {
  state.cVisited.add(node.id);
  if (node.slot) {
    const cur = state.cSlotFill[node.slot.name];
    if (!cur || cur.level < node.slot.level) state.cSlotFill[node.slot.name] = node.slot;
  }
  if (node.memo) state.cMemos.push(node.memo);
  state.cTranscript.push({ label: node.label, text: node.content });
  addNote(`✒ 새로 들었다: ${node.label}`);
  const line = await actMarta(
    `길드마스터의 말에 답해서 다음 사실을 자연스럽게, 네 말투로 전달해라: "${node.content}". ` +
      "이 사실에 포함되지 않은 구체적 내용(색·크기·이름·장소)은 지어내지 마라. " + (extraDirective || ""),
    playerLine
  );
  addBubble("marta", line);
  if (node.cue) {
    state.cTranscript.push({ cue: true, text: "마르타가 말끝을 흐리며 시선을 피했다." });
    addNote("✎ 마르타가 말끝을 흐리며 시선을 피했다 — 뭔가 더 있다.");
  }
}

// ---------- 의뢰서 국면 (공용 — 안 2 미리보기) ----------

function collectedFacts() {
  if (MODE === "C") {
    const rows = [];
    for (const slot of ["종류", "대상", "규모", "장소"]) {
      const f = state.cSlotFill[slot];
      rows.push(`${slot}: ` + (f ? f.text : "기재 없음"));
    }
    for (const m of state.cMemos) rows.push("메모: " + m);
    return rows;
  }
  if (MODE === "A") {
    const rows = [];
    for (const slot of ["종류", "대상", "규모", "장소"]) {
      const lv = state.slotState[slot];
      const blocked = state.blocked[slot];
      rows.push(`${slot}: ` + (lv === 0 ? (blocked ? `기재 없음 (물었으나 막힘 — ${blocked})` : "기재 없음") : CASE.slots[slot].truth[lv]));
    }
    return rows;
  }
  return CASE.fragments.filter((f) => state.unlocked.has(f.id)).map((f) => `${f.topic}: ${f.text}`);
}

function showCommission() {
  state.ended = true;
  $("chat-controls").style.display = "none";
  $("commission").style.display = "block";
  $("dictation").innerHTML = collectedFacts().map((r) => "<li>" + escapeHtml(r) + "</li>").join("");
}

// ---------- 보수 흥정 — 판정은 지갑 규칙이, 대사는 마르타가 ----------

let feeBusy = false;
async function offerFee() {
  if (feeBusy || state.feeAgreed) return;
  const amount = parseInt($("fee").value, 10);
  if (!amount || amount < 1) return;
  feeBusy = true;
  $("fee-offer").disabled = true;
  $("fee-result").textContent = "…";

  let accepted = false;
  let directive;
  if (amount <= MARTA_WALLET.easy) {
    accepted = true;
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했고, 너는 그 정도면 낼 수 있다. 안도하며 고마워하며 수락해라.`;
  } else if (amount <= MARTA_WALLET.cap) {
    accepted = true;
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했다. 낼 수는 있지만 겨울 땔감 값을 헐어야 하는 큰돈이다. 머뭇거리다가 수락해라 — 부담을 숨기지 못한다.`;
  } else {
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했지만 너에게는 그만한 돈이 없다. 눈물이 그렁해져서, ${MARTA_WALLET.counter}은화까지는 어떻게든 마련해 보겠다고 조심스럽게 역제안해라.`;
  }

  const playerLine = $("fee-line").value.trim() || `의뢰비는 ${amount}은화입니다.`;
  try {
    const line = await actMarta(directive, playerLine);
    addBubble("player", playerLine);
    addBubble("marta", line);
    if (accepted) {
      state.fee = amount;
      state.feeAgreed = true;
      const strained = amount > MARTA_WALLET.easy;
      $("fee-result").textContent =
        `합의: ${amount}은화` + (strained ? " — 마르타가 무리해서 낸다 (겨울 땔감 값)" : " — 무난히 합의됐다");
      $("fee-phase").style.opacity = "0.6";
      $("fee").disabled = true;
      $("fee-line").disabled = true;
      $("sheet-phase").style.display = "block";
      $("fee-display").textContent = `합의된 보수: ${amount}은화 — 여기서 모험가 몫이 나간다`;
    } else {
      $("fee-result").textContent = `거절 — 마르타는 ${amount}은화를 낼 수 없다. 다시 제시할 수 있다.`;
      $("fee-offer").disabled = false;
    }
  } catch (e) {
    $("fee-result").textContent = "호출 실패: " + e.message;
    $("fee-offer").disabled = false;
  }
  feeBusy = false;
}

async function submitCommission() {
  const risk = $("risk").value;
  const notes = $("notes").value.trim();
  const sheet =
    "== 받아쓰기 (청취로 확인된 정보) ==\n" + collectedFacts().join("\n") +
    "\n\n== 길드마스터의 판단 ==\n추정 위험도: " + risk + "급\n보수: " + state.fee + "은화 (여기서 파티 몫이 나간다)\n특이사항: " + (notes || "(없음)");

  $("commission-submit").disabled = true;
  $("prep-result").innerHTML = "<em>브란이 의뢰서를 읽고 있다…</em>";
  try {
    const prep = await readCommission(sheet);
    let html = `<h3>파티장 브란의 준비</h3>`;
    html += `<p class="brn-reply">「${escapeHtml(prep.reply)}」</p>`;
    html += `<p><b>브란이 정한 인원:</b> ${prep.partySize}명 — 의뢰서를 읽고 그가 정했다. 네가 정한 게 아니다</p>`;
    html += `<p><b>읽어낸 위험:</b> ${escapeHtml(prep.perceivedRisk)}</p>`;
    html += `<b>준비 목록</b><ul>` + prep.preparations.map((p) => `<li>${escapeHtml(p)}</li>`).join("") + `</ul>`;
    if (prep.concerns.length)
      html += `<b>브란이 불안해하는 빈칸</b><ul>` + prep.concerns.map((c) => `<li>${escapeHtml(c)}</li>`).join("") + `</ul>`;
    html += `<hr><h3>세계의 진실 (대조용)</h3><ul>` + CASE.worldTruth.map((t) => `<li>${escapeHtml(t)}</li>`).join("") + `</ul>`;
    html += `<p class="verdict-hint">브란의 준비가 진실을 얼마나 덮는가 — 덮이지 않은 항목이 파견에서 피가 된다.<br>` +
      `<b>이것이 기둥 6이다: 네가 쓴 만큼만 그들이 준비한다.</b></p>`;
    $("prep-result").innerHTML = html;
  } catch (e) {
    $("prep-result").innerHTML = `<span class="error">호출 실패: ${escapeHtml(e.message)}</span>`;
    $("commission-submit").disabled = false;
  }
}

// ---------- 입력 처리 ----------

let busy = false;
async function onSend() {
  const input = $("q");
  const text = input.value.trim();
  if (!text || busy || state.ended) return;
  busy = true;
  input.value = "";
  input.disabled = true;
  $("send").disabled = true;
  addBubble("player", text);
  const budgetBefore = state.budget;
  const thinking = addNote("…");
  try {
    if (MODE === "A") await turnA(text);
    else if (MODE === "B") await turnB(text);
    else await turnC(text);
  } catch (e) {
    addNote("⚠ 호출 실패 (칸은 소모되지 않음): " + e.message);
    state.budget = budgetBefore;
  }
  thinking.remove();
  renderPanel();
  if (state.budget <= 0) {
    addNote("행동 칸을 모두 썼다 — 의뢰서를 쓸 시간이다.");
    showCommission();
  }
  busy = false;
  input.disabled = false;
  $("send").disabled = false;
  input.focus();
}

// ---------- 초기화 ----------

function init() {
  if (!window.PROTO_CONFIG || !window.PROTO_CONFIG.apiKey || window.PROTO_CONFIG.apiKey.indexOf("sk-") !== 0) {
    document.body.innerHTML =
      "<div class='setup-error'>config.js가 없거나 API 키가 비어 있습니다.<br>" +
      "config.example.js를 config.js로 복사하고 키를 넣어주세요.</div>";
    return;
  }
  $("mode-title").textContent =
    MODE === "A" ? "프로토 A — 슬롯 × 깊이 (정보 퍼즐)"
    : MODE === "B" ? "프로토 B — 신뢰 게이지 (사람 읽기)"
    : "프로토 C — 단서 그물 (파고들기)";
  $("panel-title").textContent =
    MODE === "A" ? "의뢰서 초안 (슬롯 상태)" : MODE === "B" ? "마르타의 상태" : "청취록 — 들은 것";
  addBubble("marta", MODE === "C" ? CASE_C.clientIntro : CASE.clientIntro, "marta");
  renderPanel();
  $("send").addEventListener("click", onSend);
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) onSend();
  });
  $("end-intake").addEventListener("click", () => {
    addNote("청취를 마쳤다 — 보수를 정하고 의뢰서를 쓴다.");
    showCommission();
  });
  $("fee-offer").addEventListener("click", offerFee);
  $("commission-submit").addEventListener("click", submitCommission);
  $("q").focus();
}

document.addEventListener("DOMContentLoaded", init);
