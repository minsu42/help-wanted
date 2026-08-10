/* 청취 프로토 4 — "의뢰서의 빈칸을 말로 채운다" (GDD 재작성 v6)
   재는 것: Q1(응대권 값) · Q3(칸당 상한) · 그리고 티키타카로 느껴지는가.
   판정은 전부 규칙 엔진. LLM은 대사 둘을 생성할 뿐이다. */

const OCC = {
  '주민': { knows:[15,55,30], tells:[0,5,95],   lev:'없음' },
  '상인': { knows:[10,35,55], tells:[5,20,75],  lev:'손익' },
  '관리': { knows:[5,25,70],  tells:[10,35,55], lev:'절차' },
  '갱단': { knows:[0,5,95],   tells:[70,25,5],  lev:'없음' },
  '귀족': { knows:[5,20,75],  tells:[45,35,20], lev:'체면' },
};
const $ = s => document.querySelector(s);
let T, Q, HB, S;

const mb = s0 => { let s=s0>>>0; return () => { s=(s+0x6d2b79f5)>>>0; let t=s;
  t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296; }; };
const pk = (r,d) => { const tot=d.reduce((a,b)=>a+b,0); let x=r()*tot;
  for (let i=0;i<d.length;i++) if ((x-=d[i])<0) return i; return d.length-1; };

/* ---------- F1 — 여기서만 RNG ---------- */
function realize(occ, seed) {
  const rng = mb(seed), o = OCC[occ], knows={}, tells={};
  for (const s of Object.keys(Q.slots)) {          // 파일의 칸 순서 = RNG 소비 순서
    knows[s] = pk(rng, o.knows); tells[s] = pk(rng, o.tells);
  }
  return { knows, tells, lev: o.lev };
}

/* ---------- 상태 ---------- */
const slotNames = () => Object.keys(Q.slots);
const stepOf = (s, L) => Q.slots[s].steps[L-1];      // L: 1=어렴풋 2=확실
const display = s => S.block[s] ? '막힘' : ['미상','어렴풋','확실'][S.got[s]];
const nextL = s => S.got[s] + 1;
const capReached = s => { const c = Number($('#cap').value)||0;
  return c > 0 && (S.tries[s]||0) >= c; };

/** 일깨우기 재료 = 밖에서 온 것만 (책 + P4 소문). 들은 것은 못 쓴다 (R5) */
const hintPool = () => HB;
/** 들이대기 재료 = 들은 것 + 책 (R6) */
const leverPool = () => [...S.heard.map(id => S.heardMap[id]), ...HB];

/* ---------- 화면 ---------- */
function bubble(text, who) {
  const d=document.createElement('div');
  d.className='bubble'+(who==='me'?' me':'');
  d.innerHTML=`<b>${who==='me'?'나':S.occ}</b>${text}`;
  $('#log').appendChild(d); $('#log').scrollTop=1e9;
  S.history.push({ who: who==='me'?'길드마스터':S.occ, text });
}
function note(t, cls='') { const d=document.createElement('div');
  d.className='sys '+cls; d.textContent=t; $('#log').appendChild(d); $('#log').scrollTop=1e9; }
const face = c => { $('#face').className='face '+c; };

/* ---------- 판정 (F2) ---------- */
function judge(s) {
  const L = nextL(s);
  if (L > 2) return 'done';
  if (S.knows[s] < L) return 'unknown';
  if (S.tells[s] < L) return 'evade';
  return 'told';
}

/* ---------- 행동 ---------- */
async function act(verb, material) {
  if (S.busy) return;
  S.busy = true;
  const s = S.focus;
  try {
    if (verb === 'skip') { await say('skip', s, null, null); S.focus = null; return; }
    if (S.tickets <= 0) { note('오늘은 더 응대할 수 없다.'); return; }

    if (verb === 'hint') {                                   // R5 일깨우기
      S.tickets--; S.tries[s] = (S.tries[s]||0)+1;
      const ok = material.hintTags.some(t => Q.slots[s].hintTags.includes(t));
      if (!ok) { note('통하지 않았다 — 응대권 1.', 'cost'); face('mute');
        await say('hintFail', s, material.text, null); return; }
      S.knows[s] = Math.max(S.knows[s], nextL(s));
      note('기억을 일깨웠다.', 'good');
      await reveal(s, material.text, 'hint'); return;
    }
    if (verb === 'lever') {                                  // R6 들이대기
      S.tickets--; S.tries[s] = (S.tries[s]||0)+1;
      const ok = S.lev !== '없음' && material.leverageTag === S.lev;
      if (!ok) { note('통하지 않았다 — 응대권 1. 다시 시도할 수는 있다.', 'cost'); face('hide');
        await say('leverFail', s, material.text, null); return; }
      S.tells[s] = Math.max(S.tells[s], nextL(s));
      note('입이 열렸다.', 'good');
      await reveal(s, material.text, 'lever'); return;
    }
    // ask / press
    S.tickets--; S.tries[s] = (S.tries[s]||0)+1;
    const r = judge(s);
    if (r === 'told') { await reveal(s, null, verb); return; }
    S.block[s] = r === 'unknown' ? '무지' : '은폐';
    face(r === 'unknown' ? 'mute' : 'hide');
    await say(r, s, null, null);
  } finally {
    // ⚠ busy를 먼저 내리고 나서 그린다. 반대로 하면 모든 칸이 클릭 불가로 그려진다.
    S.busy = false;
    render();
  }
}

/** 칸이 채워진다 */
async function reveal(s, material, verb) {
  const L = nextL(s), step = stepOf(s, L);
  S.got[s] = L; S.block[s] = null;
  const id = `${s}:${L}`;
  S.heardMap[id] = { id, text: step.fact, leverageTag: step.leverageTag, hintTags: [], from:'들은 것' };
  if (!S.heard.includes(id)) S.heard.push(id);
  face('');
  await say('told', s, material, step.fact, verb);
}

async function say(outcome, s, material, revealed, verb) {
  const topic = s ? (nextL(s) <= 2 ? stepOf(s, Math.min(nextL(s),2)).topic : Q.slots[s].steps[1].topic) : null;
  const v = verb || (outcome==='skip' ? 'skip'
    : outcome==='hintFail' ? 'hint' : outcome==='leverFail' ? 'lever'
    : S.got[s] > 0 ? 'press' : 'ask');
  if (!window.LLM.ok || S.dead) return offline(outcome, s, material, revealed, v);
  $('#actions').innerHTML = '<p class="sys">…</p>';
  try {
    const r = await window.LLM.turn({ occ:S.occ, verb:v, topic, material,
      outcome, revealed, history:S.history });
    bubble(r.me, 'me'); bubble(r.them, 'them');
  } catch (e) {
    S.dead = true; $('#llm-state').textContent='LLM 끊김 — 폴백';
    $('#llm-state').className='llm-state bad';
    offline(outcome, s, material, revealed, v);
  }
}
const FB_ME = { ask:s=>`"${s}은(는) 어떻게 됩니까?"`, press:s=>`"${s}에 대해 좀 더 자세히요."`,
  hint:(s,m)=>`"제가 알기로는… ${m}"`, lever:(s,m)=>`"${m} — 그렇게 들었습니다만."`,
  skip:s=>`"${s}은(는) 비워 두겠습니다."` };
const FB_THEM = { told:f=>`"${f}."`, unknown:()=>'"글쎄요… 저는 거기까지는 모르겠습니다."',
  evade:()=>'"그건 이 일과 상관없는 이야기입니다."',
  hintFail:()=>'"…그게 이 일과 무슨 상관인지 모르겠습니다."',
  leverFail:()=>'"예, 뭐. 그런 이야기가 있지요."', skip:()=>'"…예. 그러시다면야."' };
function offline(outcome, s, material, revealed, v) {
  bubble((FB_ME[v]||FB_ME.ask)(s, material), 'me');
  bubble((FB_THEM[outcome]||FB_THEM.told)(revealed), 'them');
}

/* ---------- 재료 고르기 ---------- */
function pickMaterial(kind) {
  const isHint = kind === 'hint';
  $('#modal-title').textContent = isHint ? '무엇을 건네겠습니까?' : '무엇을 들이대겠습니까?';
  $('#modal-sub').textContent = isHint
    ? '밖에서 알아 온 것만 건넬 수 있다. 이 칸과 이어지는 이야기여야 한다.'
    : '아는 것 중 하나를 꺼낸다. 무엇이 이 사람에게 아플까?';
  const list = $('#modal-list'); list.innerHTML='';
  const pool = isHint ? hintPool() : leverPool();
  if (!pool.length) list.innerHTML='<p class="sys">꺼낼 것이 없다.</p>';
  for (const m of pool) {
    const b=document.createElement('button'); b.className='lev';
    b.innerHTML = `<span class="src">${m.book||m.from}</span> ${m.text}`;
    if (S.debug) b.innerHTML += ` <span class="tag">[${isHint?(m.hintTags.join('/')||'-'):(m.leverageTag||'-')}]</span>`;
    b.onclick = () => { $('#modal').hidden=true; act(kind, m); };
    list.appendChild(b);
  }
  $('#modal').hidden = false;
}

/* ---------- 렌더 ---------- */
function render() {
  $('#who').textContent = `${S.occ} · ${S.debug ? '아픈 곳: '+S.lev : '아픈 곳 ?'}`;
  $('#tickets').innerHTML = Array.from({length:S.tk0},(_,i)=>
    `<span class="${i<S.tickets?'':'spent'}">▮</span>`).join('');

  // 의뢰서
  const box=$('#form'); box.innerHTML='';
  const row=(k,txt,cls,click,title)=>{ const el=document.createElement(click?'button':'div');
    el.className='slot '+cls+(click?' askable':'')+(S.focus===k?' focus':'');
    el.innerHTML=`<span class="k">${k}</span><span class="v">${txt}</span>`;
    if (click) { el.title=title; el.onclick=click; } box.appendChild(el); };
  row('종류','조사','certain',null);
  let filled=0;
  for (const s of slotNames()) {
    const st=display(s);
    const txt={'미상':'?','막힘':S.block[s]==='은폐'?'말하지 않음':'본인도 모름',
      '어렴풋':stepOf(s,1).fact.slice(0,14)+'…','확실':stepOf(s,2).fact.slice(0,14)+'…'}[st];
    const cls={'미상':'unknown','막힘':'blocked','어렴풋':'vague','확실':'certain'}[st];
    if (st==='어렴풋'||st==='확실') filled += st==='확실'?1:0.5;
    const open = st!=='확실' && !capReached(s) && S.tickets>0 && !S.busy;
    row(s, txt, cls, open ? () => { S.focus=s; render(); } : null,
      capReached(s) ? '이 칸은 상한에 걸렸다' : `${s}을(를) 다룬다`);
  }
  $('#done').textContent = `${filled} / ${slotNames().length}`;

  // 행동 (R9 — 상황이 정한다)
  const a=$('#actions'); a.innerHTML='';
  const s=S.focus;
  if (!s) { a.innerHTML='<p class="sys">의뢰서의 칸을 눌러 시작한다.</p>'; }
  else {
    const st=display(s), acts=[];
    if (capReached(s)) acts.push(['이 칸은 더 다룰 수 없다', null]);
    else if (st==='미상') acts.push([`${s}을(를) 묻는다`, ()=>act('ask')]);
    else if (st==='어렴풋') acts.push([`${s}을(를) 더 캐묻는다`, ()=>act('press')]);
    else if (st==='막힘' && S.block[s]==='무지')
      acts.push(['일깨운다 — 아는 이야기를 건넨다', hintPool().length?()=>pickMaterial('hint'):null]);
    else if (st==='막힘' && S.block[s]==='은폐')
      acts.push(['들이댄다 — 아는 이야기를 꺼낸다', leverPool().length?()=>pickMaterial('lever'):null]);
    acts.push(['비워 두고 넘어간다', ()=>act('skip')]);
    for (const [label,fn] of acts) { const b=document.createElement('button');
      b.className='act'+(fn?'':' off'); b.textContent=label; b.disabled=!fn;
      if (fn) b.onclick=fn; a.appendChild(b); }
  }

  // 수첩
  const nb=$('#notebook'); nb.innerHTML='';
  const add=(m,src)=>{ const d=document.createElement('div');
    d.className='nb-item'; d.innerHTML=`<span class="src">${src}</span> ${m.text}`;
    if (S.debug) d.innerHTML += ` <span class="tag">[${m.hintTags?.join('/')||'-'} | ${m.leverageTag||'-'}]</span>`;
    nb.appendChild(d); };
  for (const id of S.heard) add(S.heardMap[id],'들은 것');
  for (const h of HB) add(h, h.book);
  $('#nb-cnt').textContent = (S.heard.length+HB.length)+'개';
}

/* ---------- 배선 ---------- */
$('#modal-cancel').onclick = () => { $('#modal').hidden=true;
  note('그만두었다 — 응대권을 쓰지 않았다.','free'); };
$('#stamp').onclick = () => { const miss=slotNames().filter(s=>display(s)!=='확실');
  note(`도장을 찍었다. 비거나 흐린 칸 ${miss.length}개: ${miss.join(', ')||'없음'}`,'stamp');
  note('(프로토는 여기까지 — 이 의뢰서로 사람이 나간다)','stamp'); };
$('#restart').onclick = boot; $('#occ').onchange = boot; $('#seed').onchange = boot;
$('#tk').onchange = boot;
$('#debug').onchange = e => { S.debug=e.target.checked; render(); };

function boot() {
  $('#log').innerHTML='';
  const occ=$('#occ').value, seed=Number($('#seed').value)||1;
  const tk=Math.max(1,Number($('#tk').value)||3);
  const r=realize(occ,seed);
  S={ occ, ...r, tickets:tk, tk0:tk, got:{}, block:{}, tries:{}, focus:null,
      heard:[], heardMap:{}, history:[], debug:$('#debug').checked, dead:false, busy:false };
  for (const s of slotNames()) { S.got[s]=0; S.block[s]=null; }
  note(`${occ}이(가) 창구에 앉는다.`);
  bubble(`"${Q.intro}"`, 'them');
  render();
}

$('#llm-state').textContent = window.LLM.ok ? 'LLM 연결됨' : 'LLM 없음 — 폴백';
$('#llm-state').className = 'llm-state ' + (window.LLM.ok?'ok':'bad');

fetch('../../src/data/quest-templates.json?v='+Date.now()).then(r=>r.json()).then(j=>{
  T=j; Q=j.questTypes['조사']; HB=j.handbook; boot();
}).catch(e=>{ document.body.innerHTML=
  '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. 서버로 열 것.<br>'+e+'</p>'; });
