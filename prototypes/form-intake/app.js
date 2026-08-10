/* 청취 프로토 4 — "의뢰서의 빈칸을 말로 채운다" (GDD 재작성 v6)
   2회차 (2026-08-10) 플레이 판정 반영:
     ① 시나리오 3종 — 누가 와도 "숲 어쩌고"이던 것
     ② **아는 건 앉자마자 다 털어놓는다** — 순순히 말할 것을 묻느라 응대권을 쓰던 잡일 제거
     ③ 묻기(진단)는 **무료**, 응대권은 **뚫는 데만** 쓴다
     ④ 누출 필터 — 모른다면서 안 밝혀진 사실을 흘리던 것
     ⑤ 길드마스터북을 권별로 갈라 정리 */

const OCC = {
  '주민': { knows:[15,55,30], tells:[0,5,95],   lev:'없음' },
  '상인': { knows:[10,35,55], tells:[5,20,75],  lev:'손익' },
  '관리': { knows:[5,25,70],  tells:[10,35,55], lev:'절차' },
  '갱단': { knows:[0,5,95],   tells:[70,25,5],  lev:'없음' },
  '귀족': { knows:[5,20,75],  tells:[45,35,20], lev:'체면' },
};
const $ = s => document.querySelector(s);
let Q, HB, SC, S;

const mb = s0 => { let s=s0>>>0; return () => { s=(s+0x6d2b79f5)>>>0; let t=s;
  t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296; }; };
const pk = (r,d) => { const tot=d.reduce((a,b)=>a+b,0); let x=r()*tot;
  for (let i=0;i<d.length;i++) if ((x-=d[i])<0) return i; return d.length-1; };

/* ---------- F1 — 여기서만 RNG ---------- */
function realize(occ, seed) {
  const rng = mb(seed), o = OCC[occ], knows={}, tells={};
  // 이 직업에게 어울리는 사연을 고른다 (시나리오 3종)
  const fit = SC.filter(s => s.fits.includes(occ));
  const pool = fit.length ? fit : SC;
  const sc = pool[Math.floor(rng()*pool.length)];
  for (const s of Object.keys(Q.slots)) { knows[s]=pk(rng,o.knows); tells[s]=pk(rng,o.tells); }
  return { knows, tells, lev:o.lev, sc };
}

/* ---------- 상태 ---------- */
const slotNames = () => Object.keys(Q.slots);
const stepOf = (s, L) => S.sc.slots[s].steps[L-1];
const display = s => S.block[s] ? '막힘' : ['미상','어렴풋','확실'][S.got[s]];
const nextL = s => S.got[s] + 1;
const capReached = s => { const c=Number($('#cap').value)||0; return c>0 && (S.tries[s]||0)>=c; };

const hintPool  = () => HB;                                        // 밖에서 온 것만 (R5)
const leverPool = () => [...S.heard.map(id=>S.heardMap[id]), ...HB]; // 들은 것 + 책 (R6)

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

/* ---------- 누출 필터 ---------- */
/** 아직 안 밝혀진 사실에만 나오는 낱말이 대사에 섞이면 그 대사를 버린다.
 *  프로토 1회차에서 "모른다"면서 "덩치가 크다"고 답하는 일이 있었다. */
function buildLeakWords() {
  const shown = new Set(), hidden = new Set();
  const tok = t => (t.match(/[가-힣]{2,}/g)||[]);
  for (const id of S.heard) tok(S.heardMap[id].text).forEach(w=>shown.add(w));
  tok(S.sc.intro).forEach(w=>shown.add(w));
  for (const h of HB) tok(h.text).forEach(w=>shown.add(w));
  for (const s of slotNames()) for (let L=nextL(s); L<=2; L++)
    tok(stepOf(s,L).fact).forEach(w=>hidden.add(w));
  return [...hidden].filter(w => !shown.has(w) && w.length>=2);
}
const leaks = (text, words) => words.filter(w => text.includes(w));

/* ---------- 판정 (F2) ---------- */
function judge(s) { const L=nextL(s);
  if (L>2) return 'done';
  if (S.knows[s] < L) return 'unknown';
  if (S.tells[s] < L) return 'evade';
  return 'told'; }

/* ---------- 행동 ---------- */
async function act(verb, material) {
  if (S.busy) return; S.busy = true;
  const s = S.focus;
  try {
    if (verb === 'skip') { await say('skip', s, null, null, 'skip'); S.focus=null; return; }

    if (verb === 'ask' || verb === 'press') {          // 진단 — **무료** (2회차 변경)
      S.tries[s] = (S.tries[s]||0)+1;
      const r = judge(s);
      if (r === 'told') { await reveal(s, null, verb); return; }   // 보통 일어나지 않는다
      S.block[s] = r==='unknown' ? '무지' : '은폐';
      face(r==='unknown' ? 'mute' : 'hide');
      await say(r, s, null, null, verb);
      return;
    }

    if (S.tickets <= 0) { note('오늘은 더 매달릴 수 없다.'); return; }

    if (verb === 'hint') {                                          // R5 일깨우기
      S.tickets--; S.tries[s]=(S.tries[s]||0)+1;
      const ok = material.hintTags.some(t => Q.slots[s].hintTags.includes(t));
      if (!ok) { note('통하지 않았다 — 응대권 1.', 'cost'); face('mute');
        await say('hintFail', s, material.text, null, 'hint'); return; }
      S.knows[s] = Math.max(S.knows[s], nextL(s));
      note('기억을 일깨웠다.', 'good');
      await reveal(s, material.text, 'hint'); return;
    }
    if (verb === 'lever') {                                         // R6 들이대기
      S.tickets--; S.tries[s]=(S.tries[s]||0)+1;
      const ok = S.lev !== '없음' && material.leverageTag === S.lev;
      if (!ok) { note('통하지 않았다 — 응대권 1. 다시 시도할 수는 있다.', 'cost'); face('hide');
        await say('leverFail', s, material.text, null, 'lever'); return; }
      S.tells[s] = Math.max(S.tells[s], nextL(s));
      note('입이 열렸다.', 'good');
      await reveal(s, material.text, 'lever'); return;
    }
  } finally {
    S.busy = false;      // ⚠ busy를 내린 다음에 그린다 (아니면 칸이 전부 클릭 불가)
    render();
  }
}

async function reveal(s, material, verb) {
  const L = nextL(s), step = stepOf(s, L);
  S.got[s] = L; S.block[s] = null;
  const id = `${s}:${L}`;
  S.heardMap[id] = { id, text:step.fact, leverageTag:step.leverageTag, hintTags:[], from:'들은 것' };
  if (!S.heard.includes(id)) S.heard.push(id);
  face('');
  await say('told', s, material, step.fact, verb);
}

async function say(outcome, s, material, revealed, verb) {
  const topic = s && nextL(s)<=2 ? stepOf(s, nextL(s)).topic : null;
  if (!window.LLM.ok || S.dead) return offline(outcome, s, material, revealed, verb);
  $('#actions').innerHTML = '<p class="sys">…</p>';
  const words = buildLeakWords();
  try {
    const r = await window.LLM.turn({ occ:S.occ, verb, topic, material,
      outcome, revealed, history:S.history });
    bubble(r.me, 'me');
    const bad = leaks(r.them, words);
    if (bad.length) { S.leaks=(S.leaks||0)+1;
      if (S.debug) note('누출 차단: '+bad.join(','), 'cost');
      bubble((FB_THEM[outcome]||FB_THEM.told)(revealed), 'them');
    } else bubble(r.them, 'them');
  } catch (e) {
    S.dead = true; $('#llm-state').textContent='LLM 끊김 — 폴백';
    $('#llm-state').className='llm-state bad';
    offline(outcome, s, material, revealed, verb);
  }
}
const FB_ME = { ask:s=>`"${s}은(는) 어떻게 됩니까?"`, press:s=>`"${s}에 대해 좀 더요."`,
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
  const isHint = kind==='hint';
  $('#modal-title').textContent = isHint ? '무엇을 건네겠습니까?' : '무엇을 들이대겠습니까?';
  $('#modal-sub').textContent = isHint
    ? '밖에서 알아 온 것만 건넬 수 있다. 이 칸과 이어지는 이야기여야 한다.'
    : '아는 것 중 하나를 꺼낸다. 무엇이 이 사람에게 아플까?';
  const list=$('#modal-list'); list.innerHTML='';
  const pool = isHint ? hintPool() : leverPool();
  if (!pool.length) list.innerHTML='<p class="sys">꺼낼 것이 없다.</p>';
  for (const m of pool) { const b=document.createElement('button'); b.className='lev';
    b.innerHTML = `<span class="src">${m.book||m.from}</span> ${m.text}`;
    if (S.debug) b.innerHTML += ` <span class="tag">[${isHint?(m.hintTags.join('/')||'-'):(m.leverageTag||'-')}]</span>`;
    b.onclick = () => { $('#modal').hidden=true; act(kind, m); };
    list.appendChild(b); }
  $('#modal').hidden = false;
}

/* ---------- 렌더 ---------- */
function render() {
  $('#who').textContent = `${S.occ} · ${S.sc.id.replace('sc-','')}`
    + (S.debug ? ` · 아픈 곳: ${S.lev}` + (S.leaks?` · 누출차단 ${S.leaks}`:'') : '');
  $('#tickets').innerHTML = Array.from({length:S.tk0},(_,i)=>
    `<span class="${i<S.tickets?'':'spent'}">▮</span>`).join('');

  const box=$('#form'); box.innerHTML='';
  const row=(k,txt,cls,click,title)=>{ const el=document.createElement(click?'button':'div');
    el.className='slot '+cls+(click?' askable':'')+(S.focus===k?' focus':'');
    el.innerHTML=`<span class="k">${k}</span><span class="v">${txt}</span>`;
    if (click){ el.title=title; el.onclick=click; } box.appendChild(el); };
  row('종류','조사','certain',null);
  let filled=0;
  for (const s of slotNames()) {
    const st=display(s);
    const txt={'미상':'?','막힘':S.block[s]==='은폐'?'말하지 않음':'본인도 모름',
      '어렴풋':stepOf(s,1).fact.slice(0,15)+'…','확실':stepOf(s,2).fact.slice(0,15)+'…'}[st];
    const cls={'미상':'unknown','막힘':'blocked','어렴풋':'vague','확실':'certain'}[st];
    filled += st==='확실'?1:(st==='어렴풋'?0.5:0);
    const open = st!=='확실' && !capReached(s) && !S.busy;
    row(s, txt, cls, open?()=>{ S.focus=s; render(); }:null,
      capReached(s)?'이 칸은 상한에 걸렸다':`${s}을(를) 다룬다`);
  }
  $('#done').textContent = `${filled} / ${slotNames().length}`;

  // 행동 — 상황이 정한다 (R9)
  const a=$('#actions'); a.innerHTML='';
  const s=S.focus;
  if (!s) a.innerHTML='<p class="sys">의뢰서의 빈칸을 눌러 시작한다.</p>';
  else {
    const st=display(s), acts=[];
    if (capReached(s)) acts.push(['이 칸은 더 다룰 수 없다', null]);
    else if (st==='미상') acts.push([`${s}은(는) 왜 안 적혔는지 묻는다  (무료)`, ()=>act('ask')]);
    else if (st==='어렴풋') acts.push([`${s}을(를) 더 캐묻는다  (무료)`, ()=>act('press')]);
    else if (st==='막힘' && S.block[s]==='무지')
      acts.push(['일깨운다 — 아는 이야기를 건넨다  (응대권 1)',
        hintPool().length?()=>pickMaterial('hint'):null]);
    else if (st==='막힘' && S.block[s]==='은폐')
      acts.push(['들이댄다 — 아는 이야기를 꺼낸다  (응대권 1)',
        leverPool().length?()=>pickMaterial('lever'):null]);
    acts.push(['비워 두고 넘어간다', ()=>act('skip')]);
    for (const [label,fn] of acts) { const b=document.createElement('button');
      b.className='act'+(fn?'':' off'); b.textContent=label; b.disabled=!fn;
      if (fn) b.onclick=fn; a.appendChild(b); }
  }

  // 수첩 — 「들은 것」과 「길드마스터북(권별)」을 갈라 놓는다
  const nb=$('#notebook'); nb.innerHTML='';
  const group=(title, items, cls)=>{ if(!items.length) return;
    const h=document.createElement('div'); h.className='nb-head'; h.textContent=title;
    nb.appendChild(h);
    for (const m of items){ const d=document.createElement('div');
      d.className='nb-item '+cls; d.textContent=m.text;
      if (S.debug) d.innerHTML += ` <span class="tag">[${m.hintTags?.join('/')||'-'} | ${m.leverageTag||'-'}]</span>`;
      nb.appendChild(d); } };
  group('들은 것', S.heard.map(id=>S.heardMap[id]), 'heard');
  for (const book of ['도감','지역','조직','시세'])
    group(book, HB.filter(h=>h.book===book), 'book');
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
  S={ occ, ...realize(occ,seed), tickets:tk, tk0:tk, got:{}, block:{}, tries:{},
      focus:null, heard:[], heardMap:{}, history:[], debug:$('#debug').checked,
      dead:false, busy:false, leaks:0 };
  for (const s of slotNames()) { S.got[s]=0; S.block[s]=null; }

  // ★ 앉자마자 **말할 수 있는 것은 다 말한다** (2회차 변경)
  const told=[];
  for (const s of slotNames()) {
    const upto = Math.min(S.knows[s], S.tells[s]);
    for (let L=1; L<=upto; L++) {
      const step=stepOf(s,L), id=`${s}:${L}`;
      S.got[s]=L;
      S.heardMap[id]={ id, text:step.fact, leverageTag:step.leverageTag, hintTags:[], from:'들은 것' };
      S.heard.push(id);
      if (L===upto) told.push(step.fact);
    }
  }
  note(`${occ}이(가) 창구에 앉는다.`);
  bubble(`"${S.sc.intro}"`, 'them');
  if (told.length) bubble(`"${told.join('. ')}."`, 'them');
  note('여기까지가 이 사람이 스스로 말한 것이다. 남은 빈칸은 모르거나, 말하지 않는 것이다.', 'free');
  render();
}

$('#llm-state').textContent = window.LLM.ok ? 'LLM 연결됨' : 'LLM 없음 — 폴백';
$('#llm-state').className = 'llm-state ' + (window.LLM.ok?'ok':'bad');

fetch('../../src/data/quest-templates.json?v='+Date.now()).then(r=>r.json()).then(j=>{
  Q=j.questTypes['조사']; SC=Q.scenarios; HB=j.handbook; boot();
}).catch(e=>{ document.body.innerHTML=
  '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. 서버로 열 것.<br>'+e+'</p>'; });
