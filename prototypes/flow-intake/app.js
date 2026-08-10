/* 청취 프로토 3 — 흐르는 대화 + 생성 선택지 + **주도권 3종** (2026-08-10 3회차)
   추가된 것:
     ① 의뢰서 빈칸을 눌러 대화를 건다 (Papers, Please — 심문은 플레이어가 개시한다)
     ② 수첩 — 아는 사실을 게이트가 아니어도 언제든 꺼낸다 (Discworld Noir)
     ③ 끼어들기 — 의뢰인이 말하는 도중에 고르면 말을 끊는다 (Oxenfree)
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

const FALLBACK_ASK = {
  'a-footprint':'그 발자국 이야기를 조금 더 해 주시겠습니까?',
  'b-mill':'정확히 어디쯤이었습니까?', 'c-night-sound':'밤에 났다는 그 소리는 어떤 소리였습니까?',
  'd-toes':'발자국 모양이 어땠는지 기억나십니까?', 'e-many-tracks':'자국이 하나였습니까, 여럿이었습니까?',
  'f-cave':'그 근처에 사람이 안 다니는 데가 있습니까?', 'g-directions':'소리가 어느 쪽에서 났습니까?',
  'h-track-sizes':'크기가 다 비슷했습니까?', 'i-bones':'주변에 남은 것은 없었습니까?',
  'j-hide-scrap':'가져오신 것이 있다고 하셨지요?', 'k-neighbor':'다른 분도 같은 것을 보셨습니까?',
  'l-land-dispute':'그 땅을 두고 무슨 일이 있었습니까?',
};
const RAMBLE = ['"…이런 걸 다 말씀드려도 되는지 모르겠습니다."',
  '"아무튼 그래서 여기까지 온 겁니다."', '"제 말이 두서가 없지요. 죄송합니다."'];

let Q, byId, S, timer = null, typer = null;

const mb = s0 => { let s=s0>>>0; return () => { s=(s+0x6d2b79f5)>>>0; let t=s;
  t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296; }; };
const pk = (r,d) => { const T=d.reduce((a,b)=>a+b,0); let x=r()*T;
  for (let i=0;i<d.length;i++) if ((x-=d[i])<0) return i; return d.length-1; };

/* ---------- F1 ---------- */
function realize(occ, seed) {
  const rng = mb(seed), o = OCC[occ], k={}, t={};
  for (const s of SLOT_ORDER) { if (!Q.openSlots.includes(s) && s!=='종류') continue;
    k[s]=pk(rng,o.knows); t[s]=pk(rng,o.tells); }
  k['종류']=Math.max(k['종류']??0,1); t['종류']=Math.max(t['종류']??0,1);
  const ids = Q.nodes.map(n=>n.id).sort(), fate={};
  for (const id of ids) { const n=byId[id];
    if (!n.slot) { fate[id]='inherit'; continue; }
    const s=n.slot.name, L=LV[n.slot.level];
    fate[id]= k[s]<L?'mute':(t[s]<L&&n.gateCandidate)?'gate':t[s]<L?'mute':'open'; }
  for (const id of ids) { if (fate[id]!=='inherit') continue;
    const p=byId[id].parents[0]; fate[id]= p?(fate[p]==='open'?'open':fate[p]):'open'; }
  return { fate, lev: o.lev };
}

/* ---------- 상태 ---------- */
const reachable = n => n.parents.every(p => S.opened.has(p));
// 놓친 화제는 흐름에 다시 나오지 않는다 — 수첩(유료)으로만 닿는다
const candidates = () => Q.nodes.filter(n =>
  !S.opened.has(n.id) && reachable(n) && !S.missed.has(n.id));
const clueList = () => [...S.opened].map(id => byId[id]);
const gateHere = () => Q.nodes.find(n => !S.opened.has(n.id) && reachable(n)
  && S.net.fate[n.id]==='gate');

function openNode(n) { S.opened.add(n.id); S.missed.delete(n.id);
  if (n.slot) S.slots[n.slot.name] =
    better(S.slots[n.slot.name]||'미상', n.slot.level==='certain'?'확정':'모호'); }
function blockSlot(n, why) { if (!n.slot) return;
  if ((S.slots[n.slot.name]||'미상')==='미상') S.slots[n.slot.name]='막힘';
  (S.why ??= {})[n.slot.name] = why; }
const spend = k => { S.tickets -= k; };

/* ---------- 화면 ---------- */
function stopTyping(){ if(typer){ clearInterval(typer.iv); typer.el.textContent=typer.full; typer=null; }
  if (S) S.speaking=false; $('#offer').classList.remove('interruptible'); }

/** 의뢰인의 대사는 **한 글자씩 나온다.** 그동안 선택지가 이미 떠 있고,
 *  그때 고르면 말을 끊는 것이다 (③ 끼어들기). */
function speak(text) {
  const d=document.createElement('div');
  d.className='bubble'; d.innerHTML=`<b>${S.occ}</b><span class="line"></span>`;
  $('#log').appendChild(d); $('#log').scrollTop=1e9;
  S.history.push({ who:S.occ, text });
  const el=d.querySelector('.line'); let i=0;
  S.speaking=true; $('#offer').classList.add('interruptible');
  typer = { el, full:text, iv:setInterval(() => {
    el.textContent = text.slice(0, ++i); $('#log').scrollTop=1e9;
    if (i>=text.length) { clearInterval(typer.iv); typer=null; S.speaking=false;
      $('#offer').classList.remove('interruptible'); }
  }, 28) };
}
function mine(text) { const d=document.createElement('div');
  d.className='bubble me'; d.innerHTML=`<b>나</b>${text}`;
  $('#log').appendChild(d); $('#log').scrollTop=1e9;
  S.history.push({ who:'길드마스터', text }); }
function note(text, cls='') { const d=document.createElement('div');
  d.className='sys '+cls; d.textContent=text;
  $('#log').appendChild(d); $('#log').scrollTop=1e9; }
const face = c => { $('#face').className='face '+c; };

/* ---------- 흐름 ---------- */
function clearTimer(){ if(timer){ cancelAnimationFrame(timer.raf); clearTimeout(timer.to); timer=null; }
  $('#flowfill').style.width='0%'; }

function offer(options) {
  clearTimer();
  const box=$('#offer'); box.innerHTML='';
  if (!options.length) { box.innerHTML='<p class="sys">더 물을 것이 떠오르지 않는다.</p>'; return; }
  for (const o of options) { const b=document.createElement('button');
    b.className='opt'; b.textContent=o.text;
    if (S.debug) b.innerHTML += ` <span class="tag">[${o.nodeId||('단서:'+o.clueId)}]</span>`;
    b.onclick = () => choose(o, true); box.appendChild(b); }
  const life=Math.max(3,Number($('#life').value)||9)*1000, t0=performance.now();
  timer={ raf:0, to:setTimeout(()=>expire(options), life) };
  $('#flowfill').style.width='100%';
  const step=()=>{ if(!timer) return;
    const p=Math.min(1,(performance.now()-t0)/life);
    $('#flowfill').style.width=(100-p*100)+'%';
    if (p<1) timer.raf=requestAnimationFrame(step); };
  timer.raf=requestAnimationFrame(step);
}
function expire(options) {
  clearTimer(); $('#offer').innerHTML='';
  for (const o of options) if (o.nodeId) S.missed.add(o.nodeId);
  // 실패 문구를 띄우지 않는다 (U2). 신호는 수첩이 느는 것 하나뿐이다.
  advance(null, RAMBLE[Math.floor(Math.random()*RAMBLE.length)]);
}

/* ---------- 선택 ---------- */
function choose(o, inFlow) {
  const cut = S.speaking;                     // ③ 말하는 중이면 끊은 것이다
  clearTimer(); stopTyping(); $('#offer').innerHTML='';
  mine(o.text);
  if (cut) { note('말을 끊었다.', 'cut'); S.cuts=(S.cuts||0)+1; }
  if (o.clueId) return presentClue(byId[o.clueId]);
  const n=byId[o.nodeId];
  if (!inFlow) { if (S.tickets<=0) { note('오늘은 더 물을 수 없다.'); return render(); }
    spend(1); note('수첩을 꺼내 되짚었다 — 응대권 1.', 'cost'); }
  resolveNode(n);
}
function resolveNode(n) {
  const f=S.net.fate[n.id];
  if (f==='mute') { S.opened.add(n.id); blockSlot(n,'무지'); face('mute');
    return advance(null, '"글쎄요… 저는 거기까지는 모르겠습니다."'); }
  if (f==='gate') { S.pendingGate=n; return openModal(); }
  openNode(n); face('');
  const kid=Q.nodes.find(c=>c.parents.includes(n.id) && S.net.fate[c.id]==='gate');
  if (kid) { note('말끝이 흐려진다. 시선이 잠깐 옆으로 간다.','gate'); face('tell'); }
  advance(n.fact, null);
}

/* ---------- ① 의뢰서 빈칸으로 대화를 건다 ---------- */
function pushSlot(slot) {
  clearTimer(); stopTyping(); $('#offer').innerHTML='';
  mine(`"${slot}은(는) 아직 못 들었습니다. 말씀해 주시겠습니까?"`);
  const targets = Q.nodes.filter(n => !S.opened.has(n.id) && reachable(n)
    && n.slot && n.slot.name===slot);
  if (!targets.length) { note('물을 거리가 없다 — 응대권을 쓰지 않았다.','free');
    return advance(null, '"그건… 저도 뭐라 말씀을 못 드리겠습니다."'); }
  if (S.tickets<=0) { note('오늘은 더 물을 수 없다.'); return render(); }
  spend(1); note(`의뢰서를 짚어 ${slot}을(를) 물었다 — 응대권 1.`, 'cost');
  S.forceSlot = slot;                       // 다음 선택지를 이 슬롯 쪽으로 좁힌다
  for (const t of targets) S.missed.delete(t.id);
  advance(null, null);
}

/* ---------- ② 수첩 — 아는 것을 언제든 꺼낸다 ---------- */
function presentClue(clue) {
  const g = S.pendingGate || gateHere();
  if (!g) { note('꺼낼 자리가 아니었다 — 응대권을 쓰지 않았다.','free'); S.pendingGate=null;
    return advance(null, '"…예. 그건 저도 들었습니다만, 그래서요?"'); }
  if (S.tickets<=0) { note('오늘은 더 물을 수 없다.'); return render(); }
  S.pendingGate=null; spend(1);
  if (S.net.lev!=='없음' && clue.leverageTag===S.net.lev) {
    openNode(g); face(''); note('문이 열렸다.','free'); advance(g.fact, null);
  } else {
    blockSlot(g,'은폐'); face('hide');
    note('통하지 않았다 — 응대권 1. 다시 시도할 수는 있다.','gate');
    advance(null, S.net.lev==='없음' ? '"…무슨 말씀이신지 모르겠군요."'
                                     : '"그건 이 일과 상관없는 이야기입니다."');
  }
}
function openModal() {
  const list=$('#modal-list'); list.innerHTML='';
  const clues=clueList().filter(c=>c.id!==S.pendingGate.id);
  if (!clues.length) list.innerHTML='<p class="sys">아직 내놓을 것이 없다.</p>';
  for (const c of clues) { const b=document.createElement('button');
    b.className='lev'; b.textContent=c.fact;
    if (S.debug && c.leverageTag) b.innerHTML += ` <span class="tag">[${c.leverageTag}]</span>`;
    b.onclick = () => { $('#modal').hidden=true; mine(`"제가 알기로는… ${c.fact}."`); presentClue(c); };
    list.appendChild(b); }
  $('#modal').hidden=false;
}

/* ---------- 턴 ---------- */
async function advance(saidFact, forcedLine) {
  render();
  let pool = candidates();
  if (S.forceSlot) { const nar=Q.nodes.filter(n=>!S.opened.has(n.id) && reachable(n)
      && n.slot && n.slot.name===S.forceSlot);
    if (nar.length) { pool=nar; for(const n of nar) S.missed.delete(n.id); }
    S.forceSlot=null; }
  // ⚠ 막다른 길 방지 (기둥 5). 흐름이 마르면 의뢰인이 아까 이야기를 **스스로** 다시 꺼낸다.
  //   놓친 것을 영구히 유료로만 두면 티켓 3으로 7개를 되짚을 수 없어 대화가 죽는다.
  let revived = null;
  if (!pool.length && S.missed.size) {
    revived = [...S.missed][Math.floor(Math.random()*S.missed.size)];
    S.missed.delete(revived); pool = [byId[revived]];
  }
  const cands = pool.map(n => ({ id:n.id, hint:n.topic }));   // ⚠ fact 금지 (ADR-003 D6)
  const clues = clueList().filter(c=>c.leverageTag).map(c=>({ id:c.id, text:c.fact }));
  const near = !!gateHere();

  if (revived) note('의뢰인이 아까 이야기를 다시 꺼낸다.', 'free');
  if (!window.LLM.ok || S.llmDead) return offline(saidFact, forcedLine, cands);
  $('#offer').innerHTML='<p class="sys">…</p>';
  try {
    const r = await window.LLM.turn({ occ:S.occ, history:S.history, saidFact:saidFact||null,
      candidates:cands, clues,
      mood: revived ? '아까 하다 만 이야기를 네가 먼저 다시 꺼낸다 ("그러고 보니…").'
          : forcedLine ? '지금은 새 사실을 말하지 않는다. 하던 말을 잇거나 걱정을 덧붙인다.'
          : near ? '한 대목에서 말끝을 흐린다. 무엇을 숨기는지는 말하지 않는다.' : '' });
    speak(r.say || forcedLine || '…');
    const g=gateHere();
    for (const o of r.options) if (o.clueId) o.gateId = g ? g.id : null;
    offer(r.options.filter(o => o.nodeId || o.clueId));
  } catch (e) {
    S.llmDead=true; $('#llm-state').textContent='LLM 끊김 — 폴백';
    $('#llm-state').className='llm-state bad';
    offline(saidFact, forcedLine, cands);
  }
}
function offline(saidFact, forcedLine, cands) {
  speak(forcedLine || (saidFact ? `"${saidFact}."` : '"…예, 그렇습니다."'));
  offer(cands.slice(0,3).map(c=>({ text:FALLBACK_ASK[c.id]||`${c.hint}에 대해 묻는다`, nodeId:c.id })));
}

/* ---------- 렌더 ---------- */
function render() {
  $('#who').textContent = `${S.occ} · ${S.debug ? '열쇠 '+S.net.lev : '열쇠 ?'}`
    + (S.cuts ? ` · 끊음 ${S.cuts}` : '');
  $('#tickets').innerHTML = Array.from({length:3},(_,i)=>
    `<span class="${i<S.tickets?'':'spent'}">▮</span>`).join('');

  // 의뢰서 — 빈칸/막힘은 **누를 수 있다** (①)
  const box=$('#slots'); box.innerHTML='';
  for (const s of ['종류',...Q.openSlots]) {
    const st = s==='종류'?'확정':(S.slots[s]||'미상');
    const txt = {'미상':'?','막힘':(S.why||{})[s]==='은폐'?'말하지 않음':'본인도 모름',
                 '모호':'어렴풋함','확정':'확실함'}[st];
    const cls = {'미상':'unknown','막힘':'blocked','모호':'vague','확정':'certain'}[st];
    const askable = s!=='종류' && (st==='미상'||st==='막힘');
    const el=document.createElement(askable?'button':'div');
    el.className='slot '+cls+(askable?' askable':'');
    el.innerHTML=`<span class="k">${s}</span><span class="v">${s==='종류'?'조사':txt}</span>`;
    if (askable) { el.title=`${s}을(를) 직접 묻는다 (응대권 1)`; el.onclick=()=>pushSlot(s); }
    box.appendChild(el);
  }

  // 수첩 — 놓친 것 + 아는 것 (②)
  const miss=[...S.missed].map(id=>byId[id]);
  const nb=$('#notebook'); nb.innerHTML='';
  if (!miss.length && !S.opened.size) nb.innerHTML='<p class="sys">아직 비어 있다</p>';
  for (const n of miss) { const b=document.createElement('button');
    b.className='nb-item missed'; b.textContent='↩ '+(FALLBACK_ASK[n.id]||n.topic);
    b.title='되짚어 묻는다 (응대권 1)';
    b.onclick=()=>choose({ text:FALLBACK_ASK[n.id]||n.topic, nodeId:n.id }, false);
    nb.appendChild(b); }
  for (const c of clueList()) { const b=document.createElement('button');
    b.className='nb-item clue'+(c.leverageTag?'':' dim'); b.textContent='✎ '+c.fact;
    b.title = gateHere() ? '들이댄다 (응대권 1)' : '지금은 꺼낼 자리가 아니다';
    if (S.debug && c.leverageTag) b.innerHTML += ` <span class="tag">[${c.leverageTag}]</span>`;
    b.onclick=()=>{ clearTimer(); stopTyping(); $('#offer').innerHTML='';
      mine(`"제가 알기로는… ${c.fact}."`); presentClue(c); };
    nb.appendChild(b); }
  $('#nb-cnt').textContent = (miss.length+S.opened.size)+'개';
}

/* ---------- 배선 ---------- */
$('#modal-cancel').onclick = () => { $('#modal').hidden=true;
  const n=S.pendingGate; S.pendingGate=null;
  note('그만두었다 — 응대권을 쓰지 않았다.','free');
  if (n) S.missed.add(n.id);
  advance(null, '"…예. 그럼 그 이야기는 됐고요."'); };
$('#finish').onclick = () => { clearTimer(); stopTyping(); $('#offer').innerHTML='';
  note('의뢰인을 보내고 의뢰서를 쓴다. (프로토는 여기까지)','free'); };
$('#restart').onclick = boot; $('#occ').onchange = boot; $('#seed').onchange = boot;
$('#debug').onchange = e => { S.debug=e.target.checked; render(); };

function boot() {
  clearTimer(); if(typer){clearInterval(typer.iv); typer=null;}
  $('#log').innerHTML=''; $('#offer').innerHTML='';
  const occ=$('#occ').value, seed=Number($('#seed').value)||1;
  S = { occ, net:realize(occ,seed), tickets:3, opened:new Set(), slots:{},
        missed:new Set(), history:[], debug:$('#debug').checked, llmDead:false,
        speaking:false, forceSlot:null, cuts:0 };
  for (const n of Q.nodes) if (!n.parents.length) openNode(n);
  note(`${occ}이(가) 창구에 앉는다.`);
  render();
  advance(Q.nodes.filter(n=>!n.parents.length).map(n=>n.fact).join('. ')+'.', null);
}

$('#llm-state').textContent = window.LLM.ok ? 'LLM 연결됨' : 'LLM 없음 — 폴백 모드';
$('#llm-state').className = 'llm-state ' + (window.LLM.ok ? 'ok':'bad');

fetch('../../src/data/quest-templates.json?v='+Date.now()).then(r=>r.json()).then(j=>{
  Q=j.questTypes['조사']; byId=Object.fromEntries(Q.nodes.map(n=>[n.id,n])); boot();
}).catch(e => { document.body.innerHTML =
  '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. 서버로 열 것.<br>'+e+'</p>'; });
