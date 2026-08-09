// 하루 3의뢰인 판 본체. 버리는 코드.
/* global CASE_DAY, classifyC, actAs, readCommission */

const CLIENTS = CASE_DAY.clients;

const day = {
  budget: CASE_DAY.budget,
  idx: 0,
  phase: "listening", // listening | fee | sheet | over
  per: CLIENTS.map(() => ({
    visited: new Set(["start"]),
    transcript: [],
    slotFill: {},
    memos: [],
    hist: [], // 이 의뢰인과의 대화 이력 — 티키타카용
    fee: null,
    status: "대기", // 대기 | 청취 중 | 게시됨 | 돌려보냄
    sheet: null,
    risk: null,
  })),
};

const $ = (id) => document.getElementById(id);
const log = $("log");

function active() { return CLIENTS[day.idx]; }
function pstate() { return day.per[day.idx]; }

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
}
function addBubble(who, text) {
  const div = document.createElement("div");
  div.className = "bubble " + (who === "player" ? "player" : "marta");
  div.innerHTML = "<b>" + (who === "player" ? "나" : escapeHtml(who)) + "</b>" + escapeHtml(text);
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

// ---------- 렌더 ----------

function renderQueue() {
  $("budget").textContent = day.budget;
  $("queue").innerHTML = CLIENTS.map((c, i) => {
    const st = day.per[i].status;
    const cls = i === day.idx && day.phase !== "over" ? "chip active" : "chip";
    return `<div class="${cls}">${c.name} <small>(${c.job})</small> — ${st}${day.per[i].fee ? " · " + day.per[i].fee + "은" : ""}</div>`;
  }).join("");
}

function renderTranscript() {
  $("panel-client").textContent = active() ? active().name : "";
  const p = pstate();
  let html = "";
  if (!p.transcript.length) html = `<div class="frag closed">아직 들은 것이 없다.</div>`;
  for (const e of p.transcript) {
    html += `<div class="frag ${e.cue ? "closed" : "open"}">` +
      (e.cue ? "✎ " + escapeHtml(e.text) : "✒ <b>" + escapeHtml(e.label) + "</b> — " + escapeHtml(e.text)) + `</div>`;
  }
  $("panel-body").innerHTML = html;
}

function renderAll() { renderQueue(); renderTranscript(); }

// ---------- 청취 (단서 그물 — 프로토 C와 동일한 판정) ----------

function reachableNodes() {
  const p = pstate();
  return active().nodes.filter(
    (n) => !p.visited.has(n.id) && n.parents.some((par) => p.visited.has(par))
  );
}

function say(text) { // 의뢰인 발화 — 이력에 남기며 말한다
  pstate().hist.push({ player: false, text });
  addBubble(active().name, text);
}

async function askTurn(text) {
  const c = active();
  const p = pstate();
  p.hist.push({ player: true, text });
  const reachable = reachableNodes();
  const visited = c.nodes.filter((n) => p.visited.has(n.id));
  const cls = await classifyC(text, reachable, visited);

  if (cls.nodeId === "없음") {
    addNote("대화에 없는 것을 겨냥했다 — 행동 칸을 쓰지 않았다");
    const line = await actAs(c.persona,
      "길드마스터가 네가 모르거나 대화에 없던 것을 물었다. 네 인물의 말투 그대로, 모르면 모른다고 하거나 네가 아는 이야기로 자연스럽게 돌아가라. 새로운 사실은 절대 말하지 마라.", text, p.hist);
    say(line);
    return;
  }

  const node = c.nodes.find((n) => n.id === cls.nodeId);

  if (p.visited.has(node.id)) {
    day.budget -= 1;
    addNote(`[${node.label} · 재질문] 새로 나온 것은 없다`);
    const line = await actAs(c.persona,
      `이미 말한 주제('${node.label}')를 또 물었다. 이미 말했다는 뉘앙스로 같은 내용을 더 짧게, 다른 표현으로 반복해라. 새로운 사실은 덧붙이지 마라.`, text, p.hist);
    say(line);
    return;
  }

  if (node.gated) {
    day.budget -= 1;
    if (c.gateTones.includes(cls.tone)) {
      await openNode(node, text);
      return;
    }
    addNote(`[${node.label} · ${cls.tone}] 문이 열리지 않았다`);
    const hard = cls.tone === "압박" || cls.tone === "위협";
    const line = await actAs(c.persona, hard ? c.gateRefuseHard : c.gateRefuseSoft, text, p.hist);
    say(line);
    addNote(c.gateTones.length
      ? "✎ 여기엔 뭔가 있다 — 다른 방식이 필요할지도."
      : "✎ 이 문은 어떤 말로도 열리지 않을 것 같다.");
    return;
  }

  day.budget -= 1;
  await openNode(node, text);
}

function absorbNode(p, node) { // 상태 반영 (발화 없이)
  p.visited.add(node.id);
  if (node.slot) {
    const cur = p.slotFill[node.slot.name];
    if (!cur || cur.level < node.slot.level) p.slotFill[node.slot.name] = node.slot;
  }
  if (node.memo) p.memos.push(node.memo);
  p.transcript.push({ label: node.label, text: node.content });
}

async function openNode(node, playerLine) {
  const c = active();
  const p = pstate();
  absorbNode(p, node);
  addNote(`✒ 새로 들었다: ${node.label}`);
  const line = await actAs(c.persona,
    `길드마스터의 말에 답해서 다음 사실을 자연스럽게, 네 말투로 전달해라: "${node.content}". ` +
      "이 사실에 포함되지 않은 구체적 내용은 지어내지 마라. " + (node.actNote || node.openNote || ""),
    playerLine, p.hist);
  say(line);
  if (node.cue) {
    p.transcript.push({ cue: true, text: node.cue });
    addNote("✎ " + node.cue);
  }
}

// 표면 진술 선개방 — 의뢰인이 앉자마자 하고 싶은 말을 다 한다. 무비용.
// 행동 칸은 이 진술 속 수상한 지점을 파고드는 데만 쓴다.
function openingStatement() {
  const c = active();
  const p = pstate();
  const surface = c.nodes.filter((n) => n.parents.length === 1 && n.parents[0] === "start" && !n.gated);
  const lines = [];
  for (const n of surface) {
    absorbNode(p, n);
    lines.push(n.content);
    if (n.cue) p.transcript.push({ cue: true, text: n.cue });
  }
  if (lines.length) {
    say(lines.join(" "));
    for (const n of surface) if (n.cue) addNote("✎ " + n.cue);
    addNote(`(표면 진술은 무료다 — 수상한 지점을 골라 파고들어라. 제시된 보수: ${c.offer}은)`);
  }
  say(c.offerLine);
}

// ---------- 보수 흥정 ----------

let feeBusy = false;
async function offerFee() {
  const c = active();
  const p = pstate();
  if (feeBusy || p.fee) return;
  const amount = parseInt($("fee").value, 10);
  if (!amount || amount < 1) return;
  feeBusy = true;
  $("fee-offer").disabled = true;
  $("fee-result").textContent = "…";

  const w = c.wallet;
  let accepted = false, directive, note = "";
  if (amount <= w.easy) {
    accepted = true;
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했다. ` + w.easyDirective;
    note = w.easyNote || "무난히 합의됐다";
  } else if (amount <= w.cap) {
    accepted = true;
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했다. ` + w.strainDirective;
    note = w.strainNote || "합의됐다";
  } else {
    directive = `길드마스터가 의뢰비로 ${amount}은화를 제시했다. ` +
      w.refuseDirective.replace("{counter}", String(w.counter));
  }

  const playerLine = $("fee-line").value.trim() || `의뢰비는 ${amount}은화입니다.`;
  try {
    addBubble("player", playerLine);
    p.hist.push({ player: true, text: playerLine });
    const line = await actAs(c.persona, directive, playerLine, p.hist);
    say(line);
    if (accepted) {
      p.fee = amount;
      $("fee-result").textContent = `합의: ${amount}은화 — ${note}`;
      $("fee").disabled = true;
      $("fee-line").disabled = true;
      day.phase = "sheet";
      $("sheet-phase").style.display = "block";
      $("fee-display").textContent = `합의된 보수: ${amount}은화 — 여기서 파티 몫이 나간다`;
      $("dictation").innerHTML = collectedFacts().map((r) => "<li>" + escapeHtml(r) + "</li>").join("");
    } else {
      $("fee-result").textContent = `거절 — ${c.name}은(는) ${amount}은화를 낼 수 없다(혹은 낼 생각이 없다). 다시 제시할 수 있다.`;
      $("fee-offer").disabled = false;
    }
  } catch (e) {
    $("fee-result").textContent = "호출 실패: " + e.message;
    $("fee-offer").disabled = false;
  }
  feeBusy = false;
  renderQueue();
}

// ---------- 의뢰서 ----------

function collectedFacts() {
  const p = pstate();
  const rows = [];
  for (const slot of ["종류", "대상", "규모", "장소"]) {
    const f = p.slotFill[slot];
    rows.push(`${slot}: ` + (f ? f.text : "기재 없음"));
  }
  for (const m of p.memos) rows.push("메모: " + m);
  return rows;
}

function startFeePhase() {
  const c = active();
  day.phase = "fee";
  $("chat-controls").style.display = "none";
  $("commission").style.display = "block";
  $("commission-client").textContent = c.name + " (" + c.job + ")";
  $("fee").disabled = false;
  $("fee").value = c.offer; // 의뢰인이 먼저 부른 값이 기본값
  $("fee-line").disabled = false;
  $("fee-line").value = "";
  $("fee-offer").disabled = false;
  $("fee-accept").disabled = false;
  $("fee-result").textContent = `${c.name}의 제시액: ${c.offer}은 — 그대로 받거나, 다른 값을 불러라.`;
  $("sheet-phase").style.display = "none";
  $("notes").value = "";
}

function acceptOffer() {
  const c = active();
  const p = pstate();
  if (p.fee) return;
  p.fee = c.offer;
  addNote(`— 제시액 ${c.offer}은을 그대로 받았다 —`);
  $("fee-result").textContent = `합의: ${c.offer}은화 (의뢰인 제시액 그대로)`;
  $("fee").disabled = true;
  $("fee-line").disabled = true;
  $("fee-offer").disabled = true;
  $("fee-accept").disabled = true;
  day.phase = "sheet";
  $("sheet-phase").style.display = "block";
  $("fee-display").textContent = `합의된 보수: ${c.offer}은화 — 여기서 파티 몫이 나간다`;
  $("dictation").innerHTML = collectedFacts().map((r) => "<li>" + escapeHtml(r) + "</li>").join("");
  renderQueue();
}

function postCommission() {
  const p = pstate();
  p.risk = $("risk").value;
  const notes = $("notes").value.trim();
  p.sheet =
    "== 받아쓰기 (청취로 확인된 정보) ==\n" + collectedFacts().join("\n") +
    "\n\n== 길드마스터의 판단 ==\n추정 위험도: " + p.risk + "급\n보수: " + p.fee +
    "은화 (여기서 파티 몫이 나간다)\n특이사항: " + (notes || "(없음)");
  p.status = "게시됨";
  addNote(`— ${active().name}의 의뢰서를 게시판에 붙였다 (${p.fee}은화) —`);
  nextClient();
}

async function refuseClient() {
  const c = active();
  const p = pstate();
  p.status = "돌려보냄";
  addNote(`— ${c.name}을(를) 돌려보냈다 —`);
  try {
    const line = await actAs(c.persona, c.refuseFarewell, "죄송하지만 이 의뢰는 받지 않겠습니다.", p.hist);
    addBubble(c.name, line);
  } catch (e) { /* 인사말 실패는 무시 */ }
  nextClient();
}

// ---------- 진행 ----------

function nextClient() {
  $("commission").style.display = "none";
  day.idx += 1;
  if (day.idx >= CLIENTS.length) {
    endDay();
    return;
  }
  day.phase = "listening";
  pstate().status = "청취 중";
  $("chat-controls").style.display = "flex";
  addNote("— 다음 분! —");
  say(active().intro);
  openingStatement();
  renderAll();
  $("q").focus();
}

const morning = { apps: {}, assigned: {}, posted: [] };

async function endDay() {
  day.phase = "over";
  $("chat-controls").style.display = "none";
  $("commission").style.display = "none";
  $("day-end").style.display = "block";
  renderQueue();
  const box = $("day-summary");

  morning.posted = CLIENTS.map((c, i) => ({ c, p: day.per[i] })).filter((x) => x.p.status === "게시됨");
  if (!morning.posted.length) {
    await depart(); // 게시된 것이 없으면 바로 밤으로 — 돌려보낸 자들의 진실만 남는다
    return;
  }
  box.innerHTML = "<em>다음 날 아침 — 파티장들이 게시판 앞에 모였다…</em>";
  const contracts = morning.posted.map((x) => ({ id: x.c.id, clientName: x.c.name, sheet: x.p.sheet }));
  const results = await Promise.all(
    CASE_DAY.parties.map((pt) => partyApplications(pt, contracts).catch(() => null))
  );
  CASE_DAY.parties.forEach((pt, k) => {
    morning.apps[pt.id] = results[k] ? results[k].applications : [];
  });
  renderMorning();
}

function appOf(partyId, contractId) {
  return (morning.apps[partyId] || []).find((a) => a.contractId === contractId);
}

function renderMorning() {
  const box = $("day-summary");
  let html = `<p><b>게시판에 의뢰서 ${morning.posted.length}장.</b> 지원한 파티 중에서 골라 배정해라. 배정하지 않으면 유찰된다.</p>`;
  for (const x of morning.posted) {
    const cid = x.c.id;
    html += `<div class="day-block"><h3>${x.c.name}의 의뢰 — ${x.p.fee}은 · 위험도 ${x.p.risk}급</h3>`;
    for (const pt of CASE_DAY.parties) {
      const a = appOf(pt.id, cid);
      const dec = a ? a.decision : "무시";
      const takenElsewhere = Object.entries(morning.assigned).some(([k, v]) => v === pt.id && k !== cid);
      const canAssign = dec !== "무시" && !takenElsewhere;
      const isAssigned = morning.assigned[cid] === pt.id;
      html += `<div class="applicant ${dec === "무시" ? "ignored" : ""}">` +
        `<b>${pt.name}</b> (${pt.size}인 · 역량 ${pt.skill}) — <b>${dec}</b>` +
        (a && a.comment ? ` · 「${escapeHtml(a.comment)}」` : "") +
        (canAssign ? ` <button data-assign="${cid}:${pt.id}" class="mini${isAssigned ? " on" : ""}">${isAssigned ? "배정됨 ✓" : "배정"}</button>` : "") +
        (takenElsewhere ? ` <small>(다른 의뢰에 배정됨)</small>` : "") +
        `</div>`;
    }
    if (!morning.assigned[cid]) html += `<div class="note">아직 배정 없음.</div>`;
    html += `</div>`;
  }
  html += `<button id="depart">이대로 파견 출발</button>`;
  box.innerHTML = html;
  box.querySelectorAll("[data-assign]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parts = btn.getAttribute("data-assign").split(":");
      morning.assigned[parts[0]] = morning.assigned[parts[0]] === parts[1] ? null : parts[1];
      renderMorning();
    });
  });
  $("depart").addEventListener("click", depart);
}

async function depart() {
  const box = $("day-summary");
  box.innerHTML = "<em>파티들이 떠났다. 해가 지고 있다…</em>";
  let html = `<h3>결과 보고</h3>`;
  let income = 0;
  for (const x of morning.posted) {
    const pid = morning.assigned[x.c.id];
    html += `<div class="day-block"><h3>${x.c.name}의 의뢰 (${x.p.fee}은 · ${x.p.risk}급)</h3>`;
    if (!pid) {
      html += `<p>유찰 — 아무도 가지 않았다. 의뢰인은 내일도 기다린다.</p>`;
    } else {
      const pt = CASE_DAY.parties.find((p) => p.id === pid);
      try {
        box.innerHTML = html + `<em>${pt.name}의 보고를 기다리는 중…</em>`;
        // 1) LLM: 의뢰서가 진실을 얼마나 덮는지만 추출 (좁은 채널)
        const cov = await extractCoverage(x.p.sheet, x.c.worldTruth);
        const score = { 덮음: 1, 부분: 0.5, 비어있음: 0 };
        let covSum = 0;
        const covNotes = [];
        for (let t = 0; t < x.c.worldTruth.length; t++) {
          const item = (cov.items || []).find((it) => it.truthIndex === t);
          const st = item ? item.status : "비어있음";
          covSum += score[st] || 0;
          covNotes.push(`${t}. ${st} — ${x.c.worldTruth[t]}`);
        }
        const covScore = Math.round((covSum / x.c.worldTruth.length) * 4 * 10) / 10; // 0~4
        // 2) 규칙: 전력 + 대비 − 위협 → 결과
        const power = ({ 상: 3, 중: 2, 하: 1 }[pt.skill]) * 2 + pt.size;
        const diff = power + covScore - x.c.threat;
        const outcome =
          diff >= 4 ? "완수" : diff >= 2 ? "진통 끝 완수" : diff >= 0 ? "부상 철수"
          : diff >= -2 ? "사망자 발생" : "전멸";
        const casualties =
          { "완수": "없음", "진통 끝 완수": "경상 약간", "부상 철수": "1명 부상",
            "사망자 발생": "1명 사망", "전멸": "전원" }[outcome];
        const ok = outcome === "완수" || outcome === "진통 끝 완수";
        if (ok) income += x.p.fee;
        // 3) LLM: 정해진 결과를 서술만 한다
        const story = await narrateDispatch(pt, x.p.sheet, x.c.worldTruth, outcome, casualties, covNotes.join("\n"));
        html += `<p><b>${pt.name}</b> → <b>${outcome}</b> · 인명: ${casualties}` +
          (ok ? ` · 보수 ${x.p.fee}은 정산` : ` · 보수 정산 없음`) + `</p>`;
        html += `<p class="note">판정: 전력 ${power} + 대비 ${covScore} − 위협 ${x.c.threat} = ${Math.round(diff * 10) / 10}</p>`;
        html += `<p>${escapeHtml(story)}</p>`;
      } catch (e) {
        html += `<p class="error">판정 실패: ${escapeHtml(e.message)}</p>`;
      }
    }
    html += `<b>세계의 진실</b><ul>` + x.c.worldTruth.map((t) => `<li>${escapeHtml(t)}</li>`).join("") + `</ul></div>`;
    box.innerHTML = html;
  }
  for (let i = 0; i < CLIENTS.length; i++) {
    const c = CLIENTS[i], p = day.per[i];
    if (p.status !== "돌려보냄") continue;
    html += `<div class="day-block"><h3>${c.name} — 돌려보냄</h3>` +
      `<p>받지 않은 의뢰의 결과는 장부에 남지 않는다. 세상에는 남는다.</p>` +
      `<b>세계의 진실</b><ul>` + c.worldTruth.map((t) => `<li>${escapeHtml(t)}</li>`).join("") + `</ul></div>`;
  }
  html += `<hr><p><b>정산된 수입: ${income}은화</b> <small>(완수한 의뢰만 정산된다)</small></p>` +
    `<p class="verdict-hint">네가 캐낸 만큼 적을 수 있었고, 적은 만큼 그들이 지원했고, 배정한 값을 사람이 치렀다.</p>`;
  box.innerHTML = html;
}

// ---------- 입력 ----------

let busy = false;
async function onSend() {
  const input = $("q");
  const text = input.value.trim();
  if (!text || busy || day.phase !== "listening") return;
  if (day.budget <= 0) {
    addNote("행동 칸이 없다 — 아는 것만으로 처리해야 한다. (청취 종료)");
    return;
  }
  busy = true;
  input.value = "";
  input.disabled = true;
  $("send").disabled = true;
  addBubble("player", text);
  const budgetBefore = day.budget;
  const thinking = addNote("…");
  try {
    await askTurn(text);
  } catch (e) {
    addNote("⚠ 호출 실패 (칸은 소모되지 않음): " + e.message);
    day.budget = budgetBefore;
  }
  thinking.remove();
  renderAll();
  busy = false;
  input.disabled = false;
  $("send").disabled = false;
  input.focus();
}

function init() {
  if (!window.PROTO_CONFIG || !window.PROTO_CONFIG.apiKey || window.PROTO_CONFIG.apiKey.indexOf("sk-") !== 0) {
    document.body.innerHTML =
      "<div class='setup-error'>config.js가 없거나 API 키가 비어 있습니다.<br>config.example.js를 config.js로 복사하고 키를 넣어주세요.</div>";
    return;
  }
  pstate().status = "청취 중";
  say(active().intro);
  openingStatement();
  renderAll();
  $("send").addEventListener("click", onSend);
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) onSend(); });
  $("end-intake").addEventListener("click", () => {
    if (day.phase !== "listening") return;
    startFeePhase();
    renderQueue();
  });
  $("refuse").addEventListener("click", () => { if (day.phase === "listening") refuseClient(); });
  $("refuse2").addEventListener("click", () => { if (day.phase === "fee") refuseClient(); });
  $("fee-accept").addEventListener("click", acceptOffer);
  $("fee-offer").addEventListener("click", offerFee);
  $("commission-submit").addEventListener("click", postCommission);
  $("q").focus();
}

document.addEventListener("DOMContentLoaded", init);
