/* 청취 프로토 5 — "의뢰인이 내 책상을 본다"
   가설: 입력 규칙은 v6(프로토 4) 그대로 두고 **반응 계층**만 얹으면
         "대화하고 있다"는 감각이 생기는가?

   3회차 (플레이 판정 다섯 반영):
     ① 기왕력 — "말해놓고 갑자기 모른다" → 칸별로 이미 말한 사실을 LLM에 주고
        부정 금지 + **역방향 필터** (told인데 밝혀진 사실이 대사에 없으면 폴백 교체)
     ② 대화 리본 — 로그가 오른쪽 구석이라 안 보임 → 창구 아래 무대 중앙으로
     ③ 반응 대기열 — 반응이 턴 사이에 끼어들어 "갑자기 다른 내용" → 턴 중엔
        대기열에 넣고 한가할 때만, 혼잣말 모양(.aside)으로 구별
     ④ 책 재작성 — "너무 대놓고" → data.js의 개념·통념·소문 사본 (태그 불변)
     ⑤ 말투 계약 — 존댓말/반말 오락가락 → llm.js에 직업별 어미 고정
     ⑥ 응대권 → **인내** — 자원이 게임 밖 토큰이 아니라 눈앞의 사람이 됐다.
        수학은 동일(시도마다 1). 실패로 바닥나면 자리를 뜬다.

   가드레일 (불변): 의뢰인은 내가 **한 것**에만 반응한다. **안 한 것**(빈칸)에는
   절대 반응하지 않는다. */

const OCC = {
  '주민': { knows:[15,55,30], tells:[0,5,95],   lev:'없음' },
  '상인': { knows:[10,35,55], tells:[5,20,75],  lev:'손익' },
  '관리': { knows:[5,25,70],  tells:[10,35,55], lev:'절차' },
  '갱단': { knows:[0,5,95],   tells:[70,25,5],  lev:'없음' },
  '귀족': { knows:[5,20,75],  tells:[45,35,20], lev:'체면' },
};
// 침묵을 몇 번이나 못 이기는가 — 갱단은 침묵으로 흔들리지 않는다 (그것도 정보다)
const SILENCE = { '주민':2, '상인':1, '관리':1, '귀족':1, '갱단':0 };
const LEAVE = { '갱단':'"…시간 낭비군. 간다."', '귀족':'"…이만 일어나겠소."' };

const $ = s => document.querySelector(s);
let Q, HB, SC, S;

const mb = s0 => { let s=s0>>>0; return () => { s=(s+0x6d2b79f5)>>>0; let t=s;
  t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296; }; };
const pk = (r,d) => { const tot=d.reduce((a,b)=>a+b,0); let x=r()*tot;
  for (let i=0;i<d.length;i++) if ((x-=d[i])<0) return i; return d.length-1; };

function realize(occ, seed) {
  const rng = mb(seed), o = OCC[occ], knows={}, tells={};
  const fit = SC.filter(s => s.fits.includes(occ));
  const pool = fit.length ? fit : SC;
  const sc = pool[Math.floor(rng()*pool.length)];
  for (const s of Object.keys(Q.slots)) { knows[s]=pk(rng,o.knows); tells[s]=pk(rng,o.tells); }
  return { knows, tells, lev:o.lev, sc };
}

/* ---------- 상태 조회 ---------- */
const slotNames = () => Object.keys(Q.slots);
const stepOf = (s, L) => S.sc.slots[s].steps[L-1];
const display = s => S.block[s] ? '막힘' : ['미상','어렴풋','확실'][S.got[s]];
const nextL = s => S.got[s] + 1;
const label12 = t => t.length>14 ? t.slice(0,14)+'…' : t;
const priorOf = s => Array.from({length:S.got[s]},(_,i)=>stepOf(s,i+1).fact);

function judge(s) { const L=nextL(s);
  if (L>2) return 'done';
  if (S.knows[s] < L) return 'unknown';
  if (S.tells[s] < L) return 'evade';
  return 'told'; }

/* ---------- 화면 조각 ---------- */
function bubble(text, who, cls='') {
  const d=document.createElement('div');
  d.className='bubble '+(who==='me'?'me':'them')+(cls?' '+cls:'');
  d.innerHTML=`<b>${who==='me'?'나':S.occ}</b>${text}`;
  $('#dialog').appendChild(d); trimDialog();
  S.history.push({ who: who==='me'?'길드마스터':S.occ, text });
}
function dnote(t, cls='') { const d=document.createElement('div');   // 리본 안의 지문
  d.className='sys '+cls; d.textContent=t; $('#dialog').appendChild(d); trimDialog(); }

/* 대화 접기 (감량 ③) — 최근 것만 크게 보이고 과거는 접는다. 열람은 언제든 가능 */
const RECENT = 5;
function trimDialog() {
  const d=$('#dialog');
  const kids=[...d.children].filter(el=>!el.classList.contains('fold-toggle'));
  kids.forEach(el=>el.classList.remove('recent'));
  kids.slice(-RECENT).forEach(el=>el.classList.add('recent'));
  const hidden = kids.length - RECENT;
  let t=d.querySelector('.fold-toggle');
  if (hidden > 0) {
    if (!t) { t=document.createElement('button'); t.className='fold-toggle';
      t.onclick=()=>{ d.classList.toggle('show-old'); trimDialog(); };
      d.prepend(t); }
    t.textContent = d.classList.contains('show-old') ? '△ 다시 접는다' : `… 지난 대화 ${hidden}줄`;
  } else if (t) t.remove();
  d.scrollTop = 1e9;
}
function note(t, cls='') { const d=document.createElement('div');    // 진행 기록 (측면)
  d.className='sys '+cls; d.textContent=t; $('#log').appendChild(d); $('#log').scrollTop=1e9; }
const face = c => { if (S && S.gone && c!=='gone') return;   // 떠난 사람의 낯빛은 못 바꾼다
  $('#face').className='face '+c; };
function glance(then='') { if (S.gone) return; face('watch'); setTimeout(()=>{ if(!S.gone) face(then); }, 900); }

/* ---------- 누출 필터 + 역방향 필터 ---------- */
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
// ①' told인데 밝혀진 사실의 낱말이 하나도 없으면 그 대사는 판정을 배신한 것이다
function betrays(text, revealed) {
  if (!revealed) return false;
  const toks = (revealed.match(/[가-힣]{2,}/g)||[]);
  return toks.length > 0 && !toks.some(t => text.includes(t));
}

/* ---------- 반응 대기열 (③') — 턴 사이에 끼어들지 않는다 ---------- */
function queueReact(kind, extra={}) {
  if (S.busy || S.reacting) { S.rq.push([kind, extra]); return; }
  react(kind, extra);
}
function flushRq() {
  if (S.busy || S.reacting || S.gone || !S.rq.length) return;
  const [k,e]=S.rq.shift(); setTimeout(()=>react(k,e), 400);
}

/* ---------- 손 (집기/놓기) ---------- */
function pickUp(item, src) {
  if (S.busy || S.gone) return;
  disarmStamp();
  if (S.hand && S.hand.id === item.id) S.hand = null;
  else S.hand = { ...item, src };
  render();
}
function dropHand() { S.hand = null; render(); }

/* ---------- 인내 (⑥') ---------- */
function spendPatience() {   // v6.1 — **헛발만** 부른다. 성공한 건네기·들이대기는 무료다
  S.tickets--;
  if (S.tickets <= 0) leave();
}
function leave() {
  S.gone = true; S.hand = null;
  face('gone');
  bubble(LEAVE[S.occ] || '"…이만 가 보겠습니다."', 'them');
  dnote('의뢰인이 자리에서 일어났다. 의뢰서는 이대로 남는다.', 'cost');
  note('인내가 바닥났다 — 의뢰인이 떠났다.', 'cost');
}

/* ---------- 행동: 한 수 (묻기/건네기/들이대기) ---------- */
async function act(verb, s, material) {
  if (S.busy || S.gone) return; S.busy = true;
  disarmStamp();
  try {
    if (verb === 'ask' || verb === 'press') {                 // 진단 — 공짜
      const r = judge(s);
      if (r === 'told') { await reveal(s, null, verb); return; }
      S.block[s] = r==='unknown' ? '무지' : '은폐';
      face(r==='unknown' ? 'mute' : 'hide');
      await say(r, s, null, null, verb);
      return;
    }

    if (verb === 'hint') {                                    // 건넨다 — 창구 너머로 (R5)
      const targets = slotNames().filter(x => S.block[x]==='무지');
      if (!targets.length) { note('지금은 건넬 이유가 없다 — 먼저 물어서 어디가 막혔는지 보라.'); return; }
      S.hand = null;
      const hit = targets.find(x => material.hintTags.some(t => Q.slots[x].hintTags.includes(t)));
      if (!hit) {
        spendPatience();                                      // 헛발만 깎는다 (v6.1)
        note('통하지 않았다 — 상대의 낯빛이 조금 식었다.', 'cost'); face('mute');
        if (!S.gone) await say('hintFail', targets[0], material.text, null, 'hint');
        return;
      }
      S.knows[hit] = Math.max(S.knows[hit], nextL(hit));      // 성공은 무료 — 아는 자가 이긴다
      note('기억을 일깨웠다.', 'good');
      await reveal(hit, material.text, 'hint'); return;
    }
    if (verb === 'lever') {                                   // 들이댄다 — 그 칸에 맞댄다 (R6)
      S.hand = null;
      const ok = S.lev !== '없음' && material.leverageTag === S.lev;
      if (!ok) {
        spendPatience();                                      // 헛발만 깎는다 (v6.1)
        note('통하지 않았다 — 상대의 낯빛이 조금 식었다.', 'cost'); face('hide');
        if (!S.gone) await say('leverFail', s, material.text, null, 'lever');
        return;
      }
      S.tells[s] = Math.max(S.tells[s], nextL(s));            // 성공은 무료
      note('입이 열렸다.', 'good');
      await reveal(s, material.text, 'lever'); return;
    }
  } finally {
    S.busy = false;      // ⚠ busy를 내린 다음에 그린다 (프로토 4의 사고)
    render();
    flushRq();
  }
}

async function reveal(s, material, verb) {
  const L = nextL(s), step = stepOf(s, L);
  S.got[s] = L; S.block[s] = null;
  if (S.assert[s]) { note(`단정 위에 사실을 덮어 적었다 — 「${S.assert[s].label}」에 줄을 그었다.`); delete S.assert[s]; }
  S.inked = s;
  const id = `${s}:${L}`;
  S.heardMap[id] = { id, text:step.fact, leverageTag:step.leverageTag, hintTags:[], from:'들은 것' };
  if (!S.heard.includes(id)) S.heard.push(id);
  face('');
  await say('told', s, material, step.fact, verb);
}

async function say(outcome, s, material, revealed, verb) {
  const topic = s && nextL(s)<=2 ? stepOf(s, nextL(s)).topic : null;
  const prior = s ? priorOf(s) : [];
  if (!window.LLM.ok || S.dead) return offline(outcome, s, material, revealed, verb);
  const words = buildLeakWords();
  try {
    const r = await window.LLM.turn({ occ:S.occ, verb, topic, material,
      outcome, revealed, prior, history:S.history });
    bubble(r.me, 'me');
    const bad = leaks(r.them, words);
    if (bad.length) { S.leaksN++;
      if (S.debug) note('누출 차단: '+bad.join(','), 'cost');
      bubble((FB_THEM[outcome]||FB_THEM.told)(revealed), 'them');
    } else if (outcome==='told' && betrays(r.them, revealed)) {   // ①' 역방향 필터
      S.betrayN++;
      if (S.debug) note('판정 배신 차단: told인데 사실 미포함', 'cost');
      bubble(FB_THEM.told(revealed), 'them');
    } else bubble(r.them, 'them');
  } catch (e) {
    S.dead = true; setLlmState(false);
    offline(outcome, s, material, revealed, verb);
  }
}
const FB_ME = { ask:s=>`"${s}은(는) 어떻게 됩니까?"`, press:s=>`"${s}에 대해 좀 더요."`,
  hint:(s,m)=>`"제가 알기로는… ${m}"`, lever:(s,m)=>`"${m} — 그렇게 들었습니다만."` };
const FB_THEM = { told:f=>`"${f}."`, unknown:()=>'"제가 아는 건 말씀드린 게 전부입니다. 그 너머는…"',
  evade:()=>'"그건 이 일과 상관없는 이야기입니다."',
  hintFail:()=>'"…그게 이 일과 무슨 상관인지 모르겠습니다."',
  leverFail:()=>'"예, 뭐. 그런 이야기가 있지요."' };
function offline(outcome, s, material, revealed, v) {
  bubble((FB_ME[v]||FB_ME.ask)(s, material), 'me');
  bubble((FB_THEM[outcome]||FB_THEM.told)(revealed), 'them');
}

/* ---------- 행동: 반응 한마디 ---------- */
const REACT_FB = {
  assertBlind: () => '"…저로서는 알 수 없는 일입니다. 그렇게 적으시렵니까."',
  assertSore:  () => '"…그렇게 적으신다면야, 뭐."',
  assertOff:   () => '"…그게 이 일과 상관이 있습니까?"',
  assertSeen:  () => '"…예. 제가 말씀드린 대로입니다."',
  silence: lev => ({ '손익':'"…오래 걸리면 그만큼 손해라서요."',
    '절차':'"…이런 것도 다 기록에 남습니까?"',
    '체면':'"…이 일이 소문나지는 않겠지요."' }[lev] || '"…"'),
  stampHand:   () => '"…벌써 다 되었습니까?"',
  bookPeek:    () => '"…책에는 뭐라고 나옵니까?"',
};
async function react(kind, extra={}) {
  if (S.reacting || S.gone) return; S.reacting = true;
  try {
    let line = null;
    if (window.LLM.ok && !S.dead) {
      try {
        const r = await window.LLM.react({ occ:S.occ, kind, history:S.history, ...extra });
        const bad = leaks(r.them, buildLeakWords());
        if (!bad.length) line = r.them;
        else { S.leaksN++; if (S.debug) note('누출 차단: '+bad.join(','), 'cost'); }
      } catch (e) { S.dead = true; setLlmState(false); }
    }
    if (S.gone) return;              // 호출 중에 떠났으면 유령 대사를 만들지 않는다
    if (!line) line = kind==='silence' ? REACT_FB.silence(S.lev) : REACT_FB[kind]();
    bubble(line, 'them', 'aside');                            // ③' 혼잣말 모양
  } finally { S.reacting = false; render(); flushRq(); }
}

/* ---------- 단정 적기 (D6) ---------- */
async function writeAssert(s, item) {
  if (S.busy || S.gone) return; S.busy = true;
  disarmStamp();
  try {
    const relevant = item.hintTags.some(t => Q.slots[s].hintTags.includes(t));
    S.assert[s] = { label: label12(item.text), text: item.text, off: !relevant };
    S.inked = s; S.hand = null;
    note(`의뢰서에 적었다 — ${s}: 「${S.assert[s].label}」. 아무도 확인해 주지 않았다.`, 'cost');
    dnote(`${s} 칸에 단정을 적어 넣었다. 의뢰인이 힐끔 본다.`);
    const r = judge(s);
    let kind;
    if (!relevant) { kind = 'assertOff'; glance(); }
    else if (r === 'unknown') { kind = 'assertBlind'; glance('mute'); }
    else if (r === 'evade')   { kind = 'assertSore'; glance('hide'); }   // 기색이 굳는 것 자체가 단서
    else                      { kind = 'assertSeen'; glance(); }
    S.busy = false; render();
    await react(kind, { label: S.assert[s].label });
    return;
  } finally { S.busy = false; render(); }
}

/* ---------- 벽 재확인 — 무료지만 응답이 말라간다 (v6.1 R4, Q3 닫힘) ---------- */
function dryPester(s) {
  if (S.busy || S.reacting || S.gone) return;
  const n = S.dry[s] = (S.dry[s]||0)+1;
  if (!S.hinted) { S.hinted = true;                 // 동사 안내는 세션당 1회 (감량 ⑦)
    note(S.block[s]==='무지'
      ? '본인도 모른다 — 책에서 알 만한 것을 집어 창구 너머로 건네 보라.'
      : '말하지 않으려 한다 — 아는 것을 집어 이 칸에 맞대 보라.'); }
  bubble(n===1
    ? (S.block[s]==='무지' ? '"말씀드렸다시피, 저는 모릅니다."' : '"…그 이야기는 이미 드린 것 같습니다만."')
    : '"…"', 'them', n>1?'aside':'');
  render();
}

/* ---------- 침묵 (E1) ---------- */
async function waitSilently() {
  if (S.busy || S.reacting || S.gone) return;
  disarmStamp();
  dnote('잠자코 기다렸다.');
  if (S.silenceLeft > 0) {
    S.silenceLeft--;
    face('watch');
    await react('silence', { lev: S.lev });
  } else {
    face('');
    bubble(S.occ==='갱단' ? '"…." (침묵을 그대로 받아넘긴다)' : '"…." (의뢰인은 창밖을 본다)', 'them', 'aside');
    render();
  }
}

/* ---------- 도장 (E3) — 잡는 것과 찍는 것 사이에 한 박자 ---------- */
function disarmStamp() {
  if (S.stampArmed) { S.stampArmed = false; note('도장에서 손을 뗐다.'); }
}
async function stampClick() {
  if (S.busy || S.reacting) return;
  if (!S.stampArmed) {
    S.stampArmed = true;
    if (!S.gone) face('nervous');
    render();
    if (!S.reacted.stamp && !S.gone) { S.reacted.stamp = true; await react('stampHand'); }
    return;
  }
  const rows = slotNames().map(s => {
    if (S.assert[s]) return `${s}=「${S.assert[s].label}」 ← 네가 적었고, 아무도 확인해 주지 않았다`;
    const st = display(s);
    return `${s}=${st==='확실'?stepOf(s,2).fact:st==='어렴풋'?stepOf(s,1).fact+' (어렴풋)':'(빈칸)'}`;
  });
  note('도장을 찍었다.', 'stamp');
  for (const r of rows) note('· '+r, 'stamp');
  note('(프로토는 여기까지 — 이 의뢰서로 사람이 나간다)', 'stamp');
  dnote('도장을 찍었다. 이 의뢰서로 사람이 나간다 — 결과는 진행 기록에.', 'cost');
  S.stampArmed = false;
  render();
}

/* ---------- 렌더 ---------- */
function setLlmState(ok) {
  $('#llm-state').textContent = ok ? 'LLM 연결됨' : 'LLM 없음 — 폴백';
  $('#llm-state').className = 'llm-state ' + (ok?'ok':'bad');
}

function render() {
  document.body.classList.toggle('holding', !!S.hand && !S.gone);
  $('#who').textContent = `${S.occ} · ${S.sc.id.replace('sc-','')}`
    + (S.debug ? ` · 아픈 곳: ${S.lev} · 침묵 ${S.silenceLeft}`
      + (S.leaksN?` · 누출차단 ${S.leaksN}`:'') + (S.betrayN?` · 배신차단 ${S.betrayN}`:'') : '');
  $('#patience').innerHTML = S.gone ? '떠남' : Array.from({length:S.tk0},(_,i)=>
    `<span class="${i<S.tickets?'':'spent'}">●</span>`).join('');

  // 의뢰서
  const box=$('#form'); box.innerHTML='';
  const mk=(k,txt,cls,vcls,click,title)=>{ const el=document.createElement(click?'button':'div');
    el.className='slot '+cls+(click?' askable':'');
    el.innerHTML=`<span class="k">${k}</span><span class="v ${vcls}">${txt}</span>`;
    if (click){ el.title=title||''; el.onclick=click; } box.appendChild(el); return el; };
  mk('종류','조사','certain','');
  for (const s of slotNames()) {
    const st=display(s);
    let txt, vcls='';
    if (S.assert[s]) { txt='단정 — '+S.assert[s].label; vcls='assert'; }
    else txt={'미상':'?','막힘':S.block[s]==='은폐'?'말하지 않음':'본인도 모름',
      '어렴풋':label12(stepOf(s,1).fact),'확실':label12(stepOf(s,2).fact)}[st];
    if (S.inked===s) vcls+=' ink';
    const cls={'미상':'unknown','막힘':'blocked','어렴풋':'vague','확실':'certain'}[st];

    let click=null, title='', extra='';
    if (S.gone) { /* 떠난 뒤에는 종이만 남는다 */ }
    else if (S.hand) {
      if (st==='막힘' && S.block[s]==='은폐') { extra='can-lever'; title='들이댄다 — 이 칸에 맞댄다 (헛짚으면 인내가 준다)';
        click=()=>act('lever', s, S.hand); }
      else if ((st==='미상'||st==='어렴풋') && S.hand.src==='book') { extra='can-write'; title='단정으로 적는다 (공짜 — 그러나 이 종이로 사람이 나간다)';
        click=()=>writeAssert(s, S.hand); }
      else if (st==='막힘' && S.block[s]==='무지') { title='모르는 사람을 몰아세울 수는 없다';
        click=()=>note('이 사람은 정말 모른다 — 몰아세울 것이 아니라, 창구 너머로 건네 보라.'); }
    } else if (!S.busy) {
      if (st==='미상') { title=`${s}을(를) 묻는다 (공짜)`; click=()=>act('ask', s); }
      else if (st==='어렴풋') { title=`${s}을(를) 더 캐묻는다 (공짜)`; click=()=>act('press', s); }
      else if (st==='막힘') { click=()=>dryPester(s); }
    }
    mk(s, txt, cls+' '+extra, vcls, click, title);
  }
  S.inked = null;

  // 길드마스터북 — 평소엔 접혀 있다(표현). 언제든 열 수 있고, **자동으로 열리지 않는다** (v6.1)
  const tabs=$('#tabs'); tabs.innerHTML='';
  for (const t of ['들은 것','도감','지역','조직','시세']) {
    const b=document.createElement('button'); b.className='tab'+(S.bookOpen&&S.tab===t?' on':'');
    b.textContent=t; b.onclick=()=>{ S.bookOpen=true; S.tab=t; render();
      if (t!=='들은 것' && !S.reacted.book && !S.gone) { S.reacted.book=true; queueReact('bookPeek'); } };
    tabs.appendChild(b);
  }
  if (S.bookOpen) { const c=document.createElement('button'); c.className='tab close';
    c.textContent='덮는다'; c.onclick=()=>{ S.bookOpen=false; render(); }; tabs.appendChild(c); }
  const items=$('#book-items'); items.innerHTML='';
  if (!S.bookOpen) items.innerHTML='<p class="sys">책이 덮여 있다 — 탭을 눌러 펼친다.</p>';
  else {
    const pool = S.tab==='들은 것'
      ? S.heard.map(id=>({...S.heardMap[id], _src:'heard'}))
      : HB.filter(h=>h.book===S.tab).map(h=>({...h, _src:'book'}));
    if (!pool.length) items.innerHTML='<p class="sys">아직 아무것도 없다.</p>';
    for (const m of pool) {
      const b=document.createElement('button');
      b.className='nb-item '+(m._src==='heard'?'heard':'book')+(S.hand&&S.hand.id===m.id?' held':'');
      b.textContent=m.text;
      if (S.debug) b.innerHTML += ` <span class="tag">[${(m.hintTags||[]).join('/')||'-'} | ${m.leverageTag||'-'}]</span>`;
      b.title='집는다';
      b.onclick=()=>pickUp(m, m._src);
      items.appendChild(b);
    }
  }
  $('#nb-cnt').textContent = (S.heard.length+HB.length)+'개';

  // 손
  const hand=$('#hand');
  if (!S.hand) hand.innerHTML='<p class="sys">비어 있다. 책의 항목을 집어 보라.</p>';
  else { hand.innerHTML='';
    const d=document.createElement('div'); d.className='hand-item';
    d.innerHTML=`<span class="src">${S.hand.book||S.hand.from}</span>${S.hand.text}`;
    hand.appendChild(d);
    const c=document.createElement('button'); c.className='ghost'; c.textContent='내려놓는다';
    c.onclick=dropHand; hand.appendChild(c); }

  // 도구
  $('#wait').disabled = S.gone;
  const st=$('#stamp');
  st.textContent = S.stampArmed ? '그대로 찍는다' : '도장에 손을 얹는다';
  st.classList.toggle('armed', S.stampArmed);
}

/* ---------- 배선 ---------- */
$('#client-zone').onclick = () => {
  if (S.busy || S.gone || !S.hand) return;
  if (S.hand.src !== 'book') { note('이 사람에게서 들은 말을 도로 건넬 수는 없다.'); return; }
  act('hint', null, S.hand);
};
$('#wait').onclick = waitSilently;
$('#stamp').onclick = stampClick;
$('#restart').onclick = boot; $('#occ').onchange = boot; $('#seed').onchange = boot;
$('#tk').onchange = boot; $('#depth').onchange = boot;
$('#debug').onchange = e => { S.debug=e.target.checked; render(); };

function boot() {
  $('#dialog').innerHTML=''; $('#dialog').classList.remove('show-old'); $('#log').innerHTML='';
  const occ=$('#occ').value, seed=Number($('#seed').value)||1;
  const tk=Math.max(1,Number($('#tk').value)||3);
  const depth=$('#depth').value;
  S={ occ, ...realize(occ,seed), tickets:tk, tk0:tk, got:{}, block:{}, assert:{},
      hand:null, tab:'들은 것', bookOpen:false, heard:[], heardMap:{}, history:[],
      debug:$('#debug').checked, dead:false, busy:false, reacting:false,
      leaksN:0, betrayN:0, rq:[], dry:{}, hinted:false,
      silenceLeft:SILENCE[occ], stampArmed:false, gone:false,
      reacted:{ book:false, stamp:false }, inked:null };
  for (const s of slotNames()) { S.got[s]=0; S.block[s]=null; }

  // 선제 진술 — 깊이는 노브다 (v6.1 R3 / Q7): 전부(기본) · 1단만 · 최소
  const told=[];
  for (const s of slotNames()) {
    const free = Math.min(S.knows[s], S.tells[s]);
    const upto = depth==='전부' ? free : depth==='1단만' ? Math.min(1, free) : 0;
    for (let L=1; L<=upto; L++) {
      const step=stepOf(s,L), id=`${s}:${L}`;
      S.got[s]=L;
      S.heardMap[id]={ id, text:step.fact, leverageTag:step.leverageTag, hintTags:[], from:'들은 것' };
      S.heard.push(id);
      if (L===upto) told.push(step.fact);
    }
  }
  dnote(`${occ}이(가) 창구에 앉는다.`);
  face('');
  bubble(`"${S.sc.intro}"`, 'them');
  if (told.length) bubble(`"${told.join('. ')}."`, 'them');
  dnote(depth==='전부'
    ? '여기까지가 이 사람이 스스로 말한 것이다. 남은 빈칸은 모르거나, 말하지 않는 것이다.'
    : '여기까지가 이 사람이 먼저 꺼낸 말이다. 남은 것은 물어야 나온다.', 'free');
  render();
}

setLlmState(window.LLM.ok);

fetch('../../src/data/quest-templates.json?v='+Date.now()).then(r=>r.json()).then(j=>{
  Q=j.questTypes['조사']; SC=Q.scenarios;
  HB = window.PROTO_HANDBOOK || j.handbook;   // ④' 프로토 전용 사본 (태그 동일)
  boot();
}).catch(e=>{ document.body.innerHTML=
  '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. 서버로 열 것.<br>'+e+'</p>'; });
