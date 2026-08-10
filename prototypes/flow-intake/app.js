/* 청취 프로토 3 — 흐르는 대화 + LLM 생성 선택지
   가설: "취조 같다"는 판정의 원인은 입력 방식이 아니라 **시간 구조**다.
        상대가 멈추지 않고, 선택지가 떴다 사라지면 대화가 된다 (Oxenfree).
   판정은 전부 규칙 엔진. LLM은 생성만 한다 (파싱 없음 → Portopia 위험 없음). */

const OCC = {
  '주민': { knows:[15,55,30], tells:[0,5,95],   lev:'체면' },
  '상인': { knows:[10,35,55], tells:[5,20,75],  lev:'손익' },
  '관리': { knows:[5,25,70],  tells:[10,35,55], lev:'절차' },
  '갱단': { knows:[0,5,95],   tells:[70,25,5],  lev:'없음' },
  '귀족': { knows:[5,20,75],  tells:[45,35,20], lev:'체면' },
};
const LV = { none:0, vague:1, certain:2 };
const SLOT_ORDER = ['종류','대상','규모','장소','기한','경로'];
const RK = ['미상','막힘','모호','확정'];
const rank = s => RK.indexOf(s), better = (a,b) => rank(a)>=rank(b)?a:b;
const $ = s => document.querySelector(s);

// LLM이 죽었을 때 쓰는 고정 문안 (폴백만으로 완주 가능해야 한다 — ADR-003 D5)
const FALLBACK_ASK = {
  'a-footprint':'그 발자국 이야기를 조금 더 해 주시겠습니까?',
  'b-mill':'정확히 어디쯤이었습니까?',
  'c-night-sound':'밤에 났다는 그 소리는 어떤 소리였습니까?',
  'd-toes':'발자국 모양이 어땠는지 기억나십니까?',
  'e-many-tracks':'자국이 하나였습니까, 여럿이었습니까?',
  'f-cave':'그 근처에 사람이 안 다니는 데가 있습니까?',
  'g-directions':'소리가 어느 쪽에서 났습니까?',
  'h-track-sizes':'크기가 다 비슷했습니까?',
  'i-bones':'주변에 남은 것은 없었습니까?',
  'j-hide-scrap':'가져오신 것이 있다고 하셨지요?',
  'k-neighbor':'다른 분도 같은 것을 보셨습니까?',
  'l-land-dispute':'그 땅을 두고 무슨 일이 있었습니까?',
};
const RAMBLE = ['"…이런 걸 다 말씀드려도 되는지 모르겠습니다."',
  '"아무튼 그래서 여기까지 온 겁니다."', '"제 말이 두서가 없지요. 죄송합니다."',
  '"저야 뭐, 아는 게 있어야 말씀을 드리지요."'];

let Q, byId, S, timer = null;

const mb = s0 => { let s = s0>>>0; return () => { s=(s+0x6d2b79f5)>>>0; let t=s;
  t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296; }; };
const pk = (r,d) => { const T=d.reduce((a,b)=>a+b,0); let x=r()*T;
  for (let i=0;i<d.length;i++) if ((x-=d[i])<0) return i; return d.length-1; };

/* ---------- F1 그물 실현 ---------- */
function realize(occ, seed) {
  const rng = mb(seed), o = OCC[occ], k = {}, t = {};
  for (const s of SLOT_ORDER) { if (!Q.openSlots.includes(s) && s!=='종류') continue;
    k[s]=pk(rng,o.knows); t[s]=pk(rng,o.tells); }
  k['종류']=Math.max(k['종류']??0,1); t['종류']=Math.max(t['종류']??0,1);
  const ids = Q.nodes.map(n=>n.id).sort(), fate = {};
  for (const id of ids) { const n = byId[id];
    if (!n.slot) { fate[id]='inherit'; continue; }
    const s=n.slot.name, L=LV[n.slot.level];
    fate[id] = k[s]<L ? 'mute' : (t[s]<L && n.gateCandidate) ? 'gate' : t[s]<L ? 'mute' : 'open'; }
  for (const id of ids) { if (fate[id]!=='inherit') continue;
    const p = byId[id].parents[0]; fate[id] = p ? (fate[p]==='open'?'open':fate[p]) : 'open'; }
  return { fate, lev: o.lev };
}

/* ---------- 상태 ---------- */
const reachable = n => n.parents.every(p => S.opened.has(p));
// ⚠ 한 번 제시됐다가 놓친 화제는 흐름에 다시 나오지 않는다 — 되짚기(응대권 1)로만.
//   이게 없으면 기다리기만 해도 그물 전체를 공짜로 판다 (「놓친 것」이 장식이 된다).
//   재미가 죽으면 `&& !S.missed.has(n.id)` 한 조각만 지우면 원래대로 돌아온다.
const candidates = () => Q.nodes.filter(n =>
  !S.opened.has(n.id) && reachable(n) && !S.missed.has(n.id));
const clueList = () => [...S.opened].map(id => byId[id]);
const hasKey = () => clueList().some(c => c.leverageTag === S.net.lev);

function openNode(n) { S.opened.add(n.id);
  if (n.slot) S.slots[n.slot.name] =
    better(S.slots[n.slot.name]||'미상', n.slot.level==='certain'?'확정':'모호'); }
function blockSlot(n, why) { if (!n.slot) return;
  if ((S.slots[n.slot.name]||'미상') === '미상') S.slots[n.slot.name]='막힘';
  (S.why ??= {})[n.slot.name] = why; }

/* ---------- 화면 ---------- */
function bubble(text, who) {
  const d = document.createElement('div');
  d.className = 'bubble' + (who==='me'?' me':'');
  d.innerHTML = `<b>${who==='me'?'나':S.occ}</b>` + text;
  $('#log').appendChild(d); $('#log').scrollTop = 1e9;
  S.history.push({ who: who==='me'?'길드마스터':S.occ, text });
}
function note(text, cls='') { const d=document.createElement('div');
  d.className='sys '+cls; d.textContent=text;
  $('#log').appendChild(d); $('#log').scrollTop=1e9; }
const face = c => { $('#face').className = 'face ' + c; };

/* ---------- 흐름 ---------- */
function clearTimer(){ if(timer){ cancelAnimationFrame(timer.raf); clearTimeout(timer.to); timer=null; }
  $('#flowfill').style.width='0%'; }

/** 선택지를 띄우고 수명을 건다. 시간이 다하면 놓친 것으로 넘어간다. */
function offer(options) {
  clearTimer();
  const box = $('#offer'); box.innerHTML = '';
  if (!options.length) { box.innerHTML = '<p class="sys">더 물을 것이 떠오르지 않는다.</p>'; return; }
  for (const o of options) {
    const b = document.createElement('button');
    b.className = 'opt'; b.textContent = o.text;
    if (S.debug) b.innerHTML += ` <span class="tag">[${o.nodeId||('단서:'+o.clueId)}]</span>`;
    b.onclick = () => choose(o, true);
    box.appendChild(b);
  }
  const life = Math.max(3, Number($('#life').value)||9) * 1000;
  const t0 = performance.now();
  timer = { raf: 0, to: setTimeout(() => expire(options), life) };
  $('#flowfill').style.width = '100%';
  const step = () => { if (!timer) return;
    const p = Math.min(1, (performance.now()-t0)/life);
    $('#flowfill').style.width = (100-p*100)+'%';
    if (p < 1) timer.raf = requestAnimationFrame(step); };
  timer.raf = requestAnimationFrame(step);
}

function expire(options) {
  clearTimer(); $('#offer').innerHTML = '';
  for (const o of options) if (o.nodeId) S.missed.add(o.nodeId);
  // 실패 문구를 띄우지 않는다 (U2) — 선택지는 조용히 사라지고, 기계적 신호는
  // 「놓친 것」 패널이 는 것 하나뿐이다. "놓쳤습니다"는 대화를 시험으로 만든다.
  advance(null, RAMBLE[Math.floor(Math.random()*RAMBLE.length)]);
}

/** 선택 처리. inFlow=true면 무료, 청취록에서 되짚으면 응대권 1. */
function choose(o, inFlow) {
  clearTimer(); $('#offer').innerHTML='';
  bubble(o.text, 'me');
  if (o.clueId) return tryGate(o);
  const n = byId[o.nodeId];
  if (!inFlow) { if (S.tickets<=0) { note('응대권이 없다.'); return render(); }
    S.tickets--; note('되짚어 물었다 — 응대권 1을 썼다.', 'cost'); }
  S.missed.delete(n.id);
  const f = S.net.fate[n.id];
  if (f === 'mute') { S.opened.add(n.id); blockSlot(n,'무지'); face('mute');
    return advance(null, '"글쎄요… 저는 거기까지는 모르겠습니다."'); }
  if (f === 'gate') { S.pendingGate = n; return openModal(); }
  openNode(n); face('');
  const kid = Q.nodes.find(c => c.parents.includes(n.id) && S.net.fate[c.id]==='gate');
  if (kid) { note('말끝이 흐려진다. 시선이 잠깐 옆으로 간다.', 'gate'); face('tell'); }
  advance(n.fact, null);
}

/* ---------- 게이트 ---------- */
function openModal() {
  const list = $('#modal-list'); list.innerHTML='';
  const clues = clueList().filter(c => c.id !== S.pendingGate.id);
  if (!clues.length) list.innerHTML = '<p class="sys">아직 내놓을 것이 없다.</p>';
  for (const c of clues) { const b=document.createElement('button');
    b.className='lev'; b.textContent=c.fact;
    if (S.debug && c.leverageTag) b.innerHTML += ` <span class="tag">[${c.leverageTag}]</span>`;
    b.onclick = () => resolveGate(c); list.appendChild(b); }
  $('#modal').hidden = false;
}
function tryGate(o) { S.pendingGate = null; resolveGate(byId[o.clueId], o.gateId); }

function resolveGate(clue) {
  $('#modal').hidden = true;
  const n = S.pendingGate; S.pendingGate = null;
  if (S.tickets<=0) { note('응대권이 없다.'); return render(); }
  S.tickets--;
  if (S.net.lev !== '없음' && clue.leverageTag === S.net.lev) {
    openNode(n); face(''); note('문이 열렸다.', 'free');
    advance(n.fact, null);
  } else {
    blockSlot(n, '은폐'); face('hide');
    note('통하지 않았다 — 응대권 1을 썼다. 다시 시도할 수는 있다.', 'gate');
    advance(null, S.net.lev==='없음' ? '"…무슨 말씀이신지 모르겠군요."'
                                     : '"그건 이 일과 상관없는 이야기입니다."');
  }
}

/* ---------- 턴 진행 ---------- */
async function advance(saidFact, forcedLine) {
  render();
  // ⚠ fact(사실 원문)를 넘기면 연기자가 묻기도 전에 답을 말해 버린다 (ADR-003 D6).
  //   넘기는 것은 '물어볼 거리의 이름'뿐이다.
  const cands = candidates().map(n => ({ id:n.id, hint:n.topic }));
  const clues = clueList().filter(c => c.leverageTag).map(c => ({ id:c.id, text:c.fact }));
  const gateNear = candidates().some(n => S.net.fate[n.id]==='gate');

  if (!window.LLM.ok || S.llmDead) return offline(saidFact, forcedLine, cands);

  $('#offer').innerHTML = '<p class="sys">…</p>';
  try {
    const r = await window.LLM.turn({ occ:S.occ, history:S.history,
      saidFact: saidFact || null, candidates: cands, clues,
      mood: forcedLine ? '지금은 새 사실을 말하지 않는다. 하던 말을 잇거나 걱정을 덧붙인다.'
          : gateNear ? '한 대목에서 말끝을 흐린다. 다만 무엇을 숨기는지는 말하지 않는다.' : '' });
    bubble(r.say || forcedLine || '…', 'them');
    // 단서 선택지는 게이트 후보가 있을 때만 의미가 있다
    const gate = candidates().find(n => S.net.fate[n.id]==='gate');
    for (const o of r.options) if (o.clueId) o.gateId = gate ? gate.id : null;
    offer(r.options.filter(o => o.nodeId || (o.clueId && o.gateId)));
  } catch (e) {
    S.llmDead = true; $('#llm-state').textContent = 'LLM 끊김 — 폴백';
    $('#llm-state').className = 'llm-state bad';
    note('(연결이 끊겨 고정 문안으로 이어간다)', 'miss');
    offline(saidFact, forcedLine, cands);
  }
}
function offline(saidFact, forcedLine, cands) {
  bubble(forcedLine || (saidFact ? `"${saidFact}."` : '"…예, 그렇습니다."'), 'them');
  offer(cands.slice(0,3).map(c => ({ text: FALLBACK_ASK[c.id] || `${c.hint}에 대해 묻는다`, nodeId: c.id })));
}

/* ---------- 렌더 ---------- */
function render() {
  $('#who').textContent = `${S.occ} · ${S.debug ? '열쇠 '+S.net.lev : '열쇠 ?'}`;
  $('#tickets').innerHTML = Array.from({length:3},(_,i)=>
    `<span class="${i<S.tickets?'':'spent'}">▮</span>`).join('');
  $('#slots').innerHTML = ['종류',...Q.openSlots].map(s=>{
    const st = s==='종류'?'확정':(S.slots[s]||'미상');
    const txt = {'미상':'?','막힘':(S.why||{})[s]==='은폐'?'말하지 않음':'본인도 모름',
                 '모호':'어렴풋함','확정':'확실함'}[st];
    const cls = {'미상':'unknown','막힘':'blocked','모호':'vague','확정':'certain'}[st];
    return `<div class="slot ${cls}"><span class="k">${s}</span><span class="v">${s==='종류'?'조사':txt}</span></div>`;
  }).join('');
  const miss = [...S.missed].map(id=>byId[id]);
  $('#missed-cnt').textContent = miss.length ? miss.length+'개' : '';
  $('#missed').innerHTML = miss.length ? '' : '<p class="sys">아직 없다</p>';
  for (const n of miss) { const b=document.createElement('button');
    b.className='missed-item'; b.textContent = FALLBACK_ASK[n.id] || n.fact;
    b.title='되짚어 묻는다 (응대권 1)';
    b.onclick = () => choose({ text: FALLBACK_ASK[n.id]||n.fact, nodeId:n.id }, false);
    $('#missed').appendChild(b); }
  const cl = clueList();
  $('#clue-cnt').textContent = cl.length+'개';
  $('#clues').innerHTML = cl.map(c=>`<div class="clue${c.leverageTag?'':' dim'}">${c.fact}${
    S.debug&&c.leverageTag?`<span class="tag">[${c.leverageTag}]</span>`:''}</div>`).join('');
}

/* ---------- 배선 ---------- */
$('#modal-cancel').onclick = () => { $('#modal').hidden=true;
  const n=S.pendingGate; S.pendingGate=null;
  note('그만두었다 — 응대권을 쓰지 않았다.','free');
  if (n) S.missed.add(n.id);
  advance(null, '"…예. 그럼 그 이야기는 됐고요."'); };
$('#finish').onclick = () => { clearTimer(); $('#offer').innerHTML='';
  note('의뢰인을 보내고 의뢰서를 쓴다. (프로토는 여기까지)','free'); };
$('#restart').onclick = boot; $('#occ').onchange = boot; $('#seed').onchange = boot;
$('#debug').onchange = e => { S.debug = e.target.checked; render(); };

function boot() {
  clearTimer(); $('#log').innerHTML=''; $('#offer').innerHTML='';
  const occ = $('#occ').value, seed = Number($('#seed').value)||1;
  S = { occ, net: realize(occ, seed), tickets:3, opened:new Set(), slots:{},
        missed:new Set(), history:[], debug:$('#debug').checked, llmDead:false };
  for (const n of Q.nodes) if (!n.parents.length) openNode(n);
  note(`${occ}이(가) 창구에 앉는다.`);
  const intro = Q.nodes.filter(n=>!n.parents.length).map(n=>n.fact).join('. ')+'.';
  bubble(`"${intro}"`, 'them');
  render();
  advance(null, null);
}

$('#llm-state').textContent = window.LLM.ok ? 'LLM 연결됨' : 'LLM 없음 — 폴백 모드';
$('#llm-state').className = 'llm-state ' + (window.LLM.ok ? 'ok' : 'bad');

fetch('../../src/data/quest-templates.json?v=' + Date.now()).then(r=>r.json()).then(j=>{
  Q = j.questTypes['조사']; byId = Object.fromEntries(Q.nodes.map(n=>[n.id,n])); boot();
}).catch(e => { document.body.innerHTML =
  '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. 서버로 열 것.<br>'+e+'</p>'; });
