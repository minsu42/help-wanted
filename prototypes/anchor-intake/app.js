/* 청취 프로토 — 앵커 전용 입력 + 정보 지렛대 게이트 (GDD 4차 개정)
   버리는 프로토타입이다. 목적은 셋만 확인하는 것:
     ① 단어를 눌러 파고드는 것이 재미있는가
     ② 지렛대 게이트가 "아, 이걸 들이대면 되겠다"를 주는가
     ③ 앵커 수 > 노드 수라서 가려내는 맛이 있는가
   LLM을 쓰지 않는다 — 새 설계는 판정 경로에 LLM이 없다. */

const OCC = {
  '주민': { knows:[15,55,30], tells:[0,5,95],   lev:'체면', reg:'조심스럽고 말이 짧다' },
  '상인': { knows:[10,35,55], tells:[5,20,75],  lev:'손익', reg:'셈이 빠르다' },
  '관리': { knows:[5,25,70],  tells:[10,35,55], lev:'절차', reg:'절차 뒤에 선다' },
  '갱단': { knows:[0,5,95],   tells:[70,25,5],  lev:'없음', reg:'말이 짧고 눈을 안 피한다' },
  '귀족': { knows:[5,20,75],  tells:[45,35,20], lev:'체면', reg:'에두른다' },
};
const LV = { none:0, vague:1, certain:2 };
const SLOT_ORDER = ['종류','대상','규모','장소','기한','경로'];
const RK = ['미상','막힘','모호','확정'];
// 미끼 앵커 — 어느 노드로도 이어지지 않는다. 가려내는 맛의 재료 (R4)
const DECOYS = ['숲','아침','마을','겨울','나무','개울','바람','장터','우물','지붕','수레',
  '장화','아이들','댁','사흘','품삯','대장간','울타리','건초','짐승','새벽','비','풀숲'];

/* 프로토 전용 — 노드의 `fact`(사실 조각)를 실제 발화로 부풀린 것.
   본선에서는 LLM 연기가 이 일을 한다 (R11). 여기서 중요한 건 문장의 질이 아니라
   **앵커가 노드 수보다 많아진다**는 것이다 (R4 규약). */
const LINES = {
  // ⚠ 규약: 각 대사는 **자식 노드의 앵커를 반드시 포함**해야 한다.
  //   없으면 그 자식을 겨냥할 방법이 없다 (프로토가 잡아낸 결함 — R3 검증에 추가).
  'a-footprint': '지난 사흘 새벽마다 숲 쪽에 커다란 발자국이 나 있었습니다. '
    + '모양이 이상했고, 한 갈래가 아니었습니다. 가죽 조각도 하나 주웠습니다.',
  'b-mill': '서쪽 숲입니다. 물레방아 지나서 개울 건너 풀숲 쪽이요. '
    + '그 위쪽 비탈에 굴이 하나 있고, 뒤편에는 뼈가 좀 쌓여 있습니다.',
  'c-night-sound': '밤이면 우는 소리가 납니다. 아이들이 무서워 잠을 못 잡니다. '
    + '한 방향이 아니었고, 이웃집도 들었다고 합니다.',
  'd-toes': '사람 발만 한데, 발가락이 셋이었습니다. 그런 짐승은 못 봤습니다.',
  'e-many-tracks': '자국이 한 갈래가 아니었습니다. 여기저기 흩어져 있었고, '
    + '크고 작은 것이 섞여 있었습니다.',
  'f-cave': '물레방아 위쪽 비탈에 굴이 하나 있습니다. 사람은 안 다니는 곳입니다. '
    + '그 땅 주인 문제로 말이 좀 있었습니다.',
  'g-directions': '소리가 한 곳에서 나는 게 아니라 사방에서 났습니다.',
  'h-track-sizes': '큰 자국이 둘, 작은 것이 예닐곱이었습니다. 새끼를 친 모양입니다.',
  'i-bones': '물레방아 뒤편에 짐승 뼈가 쌓여 있었습니다. 건초 더미 옆이요.',
  'j-hide-scrap': '가시에 걸린 가죽 조각을 주워 왔습니다. 대장간에 보여줬는데 모르겠답니다.',
  'k-neighbor': '이웃집 댁도 같은 소리를 들었다고 합니다. 마을에 말이 돕니다.',
  'l-land-dispute': '그 비탈 소유를 두고 방앗간 주인과 다툰 적이 있습니다.',
};
const lineOf = n => LINES[n.id] || n.fact;

let T, Q, byId, state;

const rank = s => RK.indexOf(s);
const better = (a,b) => rank(a) >= rank(b) ? a : b;
const $ = s => document.querySelector(s);

function mulberry32(seed){ let s = seed>>>0; return () => {
  s = (s + 0x6d2b79f5) >>> 0; let t = s;
  t = Math.imul(t ^ t>>>15, t|1); t ^= t + Math.imul(t ^ t>>>7, t|61);
  return ((t ^ t>>>14) >>> 0) / 4294967296; }; }
const pick = (rng, d) => { const tot = d.reduce((a,b)=>a+b,0); let x = rng()*tot;
  for (let i=0;i<d.length;i++) if ((x-=d[i]) < 0) return i; return d.length-1; };

/* ---------- F1: 그물 실현 ---------- */
function realize(occName, seed) {
  const rng = mulberry32(seed), o = OCC[occName], knows = {}, tells = {};
  for (const s of SLOT_ORDER) {
    if (!Q.openSlots.includes(s) && s !== '종류') continue;
    knows[s] = pick(rng, o.knows); tells[s] = pick(rng, o.tells);
  }
  knows['종류'] = Math.max(knows['종류'] ?? 0, 1);
  tells['종류'] = Math.max(tells['종류'] ?? 0, 1);
  const ids = Q.nodes.map(n=>n.id).sort(), fate = {};
  for (const id of ids) {
    const n = byId[id];
    if (!n.slot) { fate[id] = 'inherit'; continue; }
    const s = n.slot.name, L = LV[n.slot.level];
    fate[id] = knows[s] < L ? 'mute'                                   // ① 무지 우선
      : (tells[s] < L && n.gateCandidate) ? 'gate'                     // ②
      : tells[s] < L ? 'mute' : 'open';                                // ③ / ④
  }
  for (const id of ids) {
    if (fate[id] !== 'inherit') continue;
    const p = byId[id].parents[0];
    fate[id] = p ? (fate[p] === 'open' ? 'open' : fate[p]) : 'open';
  }
  return { fate, lev: o.lev };
}

/* ---------- 상태 ---------- */
function start(occName, seed) {
  const net = realize(occName, seed);
  state = { occ: occName, net, tickets: 3, opened: new Set(), slots: {},
            blocked: new Set(), log: [], anchorsUsed: new Set() };
  for (const n of Q.nodes) if (!n.parents.length) openNode(n, true);
  say(`${occName}이(가) 창구에 앉는다. ${OCC[occName].reg}.`, 'sys');
  const facts = Q.nodes.filter(n => !n.parents.length).map(n => lineOf(n));
  say(facts.join(' '), 'them');
  sys('표면 진술은 무료다 — 응대권을 쓰지 않았다.', 'free');
  render();
}

function openNode(n, free) {
  state.opened.add(n.id);
  if (n.slot) {
    const lvl = n.slot.level === 'certain' ? '확정' : '모호';
    state.slots[n.slot.name] = better(state.slots[n.slot.name] || '미상', lvl);
  }
  if (!free) state.log.push(n.id);
}
const hasClue = tag => [...state.opened].some(id => byId[id].leverageTag === tag);
const reachable = n => n.parents.every(p => state.opened.has(p));

/* ---------- 대사 ---------- */
function say(text, who) {
  const d = document.createElement('div');
  if (who === 'sys') { d.className = 'sys'; d.textContent = text; }
  else { d.className = 'bubble' + (who === 'me' ? ' me' : '');
    d.innerHTML = `<b>${who === 'me' ? '나' : state.occ}</b>` + markup(text); }
  $('#log').appendChild(d); $('#log').scrollTop = 1e9;
}
function sys(text, cls) { const d = document.createElement('div');
  d.className = 'sys ' + (cls||''); d.textContent = text;
  $('#log').appendChild(d); $('#log').scrollTop = 1e9; }

/** 대사 안의 단어를 앵커로 감싼다. 유효/무효를 겉으로 구별하지 않는다 (U3). */
function markup(text) {
  const words = [];
  for (const n of Q.nodes) for (const a of n.anchors) words.push([a, n.id]);
  for (const d of DECOYS) words.push([d, null]);
  words.sort((a,b) => b[0].length - a[0].length);
  let out = escapeHtml(text);
  const taken = [];
  for (const [w, nid] of words) {
    const i = out.indexOf(w);
    if (i < 0) continue;
    if (taken.some(([s,e]) => i < e && i + w.length > s)) continue;
    taken.push([i, i + w.length]);
  }
  // 길이순으로 자리를 잡았으니 뒤에서부터 치환
  taken.sort((a,b) => b[0]-a[0]);
  for (const [s,e] of taken) {
    const w = out.slice(s,e);
    const hit = words.find(([ww]) => ww === w);
    const nid = hit ? hit[1] : null;
    const used = nid && state.opened.has(nid) ? ' used' : '';
    out = out.slice(0,s) + `<button class="anchor${used}" data-node="${nid||''}" data-w="${w}">${w}</button>` + out.slice(e);
  }
  return out;
}
const escapeHtml = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---------- 파고들기 ---------- */
function onAnchor(nodeId, word) {
  if (state.tickets <= 0) { sys('오늘은 더 물을 수 없다.'); return; }
  const n = nodeId ? byId[nodeId] : null;
  say(`"${word}… 그건 무슨 이야기입니까?"`, 'me');

  // R5 — 유효하지 않은 앵커는 무비용
  if (!n || !reachable(n) || state.opened.has(nodeId)) {
    if (n && state.opened.has(nodeId)) { spend(); say(deflect(), 'them');
      sys('같은 이야기를 다시 물었다 — 응대권 1을 썼다.'); face(''); render(); return; }
    say(deflect(), 'them');
    sys('응대권을 쓰지 않았다.', 'free'); face(''); render(); return;
  }
  const f = state.net.fate[nodeId];
  if (f === 'mute') { spend(); state.opened.add(n.id); markBlocked(n, '무지');
    say('"글쎄요… 저는 거기까지는 모르겠습니다."', 'them'); face('mute'); render(); return; }
  if (f === 'gate') { openGate(n); return; }
  spend(); openNode(n);
  say(`"${lineOf(n)}"`, 'them');
  const child = Q.nodes.find(c => c.parents.includes(n.id) && state.net.fate[c.id] === 'gate');
  if (child) { sys('말끝이 흐려진다. 시선이 잠깐 옆으로 간다.', 'gate'); face('tell'); }
  else face('');
  render();
}
function deflect() {
  return ['"…글쎄요. 아까 말씀드린 게 전부입니다."',
          '"그건 이 일과는 상관이 없습니다."',
          '"예? …아, 아까 그 이야기 말입니까."'][Math.floor(Math.random()*3)];
}
function markBlocked(n, why) {
  if (!n.slot) return;
  const cur = state.slots[n.slot.name] || '미상';
  if (cur === '미상') state.slots[n.slot.name] = '막힘';   // 이미 얻은 것은 덮지 않는다
  (state.why ??= {})[n.slot.name] = why;
}
const spend = () => { state.tickets--; };
const face = c => { $('#face').className = 'face ' + c; };

/* ---------- 게이트: 지렛대 ---------- */
let pendingGate = null;
function openGate(n) {
  pendingGate = n;
  const clues = [...state.opened].map(id => byId[id]).filter(c => c.id !== n.id);
  $('#modal-sub').textContent = '내가 아는 것 중 하나를 내놓는다. 무엇이 이 사람에게 아플까?';
  const list = $('#modal-list'); list.innerHTML = '';
  if (!clues.length) { list.innerHTML = '<p class="sys">아직 내놓을 것이 없다.</p>'; }
  for (const c of clues) {
    const b = document.createElement('button');
    b.className = 'lev'; b.textContent = c.fact;
    if (state.debug && c.leverageTag) b.innerHTML += ` <span class="tag">[${c.leverageTag}]</span>`;
    b.onclick = () => resolveGate(c);
    list.appendChild(b);
  }
  $('#modal').hidden = false;
}
function resolveGate(clue) {
  $('#modal').hidden = true;
  const n = pendingGate; pendingGate = null;
  spend();
  say(`"제가 알기로는… ${clue.fact}."`, 'me');
  const key = state.net.lev;
  if (key !== '없음' && clue.leverageTag === key) {
    openNode(n);
    say(`"…예. 사실은, ${lineOf(n)}"`, 'them'); face('');
    sys('문이 열렸다.', 'free');
  } else {
    state.blocked.add(n.id); markBlocked(n, '은폐');
    say(key === '없음' ? '"…무슨 말씀이신지 모르겠군요."' : '"그건 이 일과 상관없는 이야기입니다."', 'them');
    face('hide');
    sys('통하지 않았다 — 응대권 1을 썼다. 다시 시도할 수는 있다.', 'gate');
  }
  render();
}

/* ---------- 렌더 ---------- */
function render() {
  $('#who').textContent = `${state.occ} · ${state.debug ? '열쇠 ' + state.net.lev : '열쇠 ?'}`;
  $('#tickets').innerHTML = Array.from({length:3}, (_,i) =>
    `<span class="${i < state.tickets ? '' : 'spent'}">▮</span>`).join('');
  $('#slots').innerHTML = ['종류', ...Q.openSlots].map(s => {
    const st = s === '종류' ? '확정' : (state.slots[s] || '미상');
    const txt = { '미상':'?', '막힘': (state.why||{})[s] === '은폐' ? '말하지 않음' : '본인도 모름',
                  '모호':'어렴풋함', '확정':'확실함' }[st];
    const cls = { '미상':'unknown','막힘':'blocked','모호':'vague','확정':'certain' }[st];
    return `<div class="slot ${cls}"><span class="k">${s}</span><span class="v">${s==='종류'?'조사':txt}</span></div>`;
  }).join('');
  const clues = [...state.opened].map(id => byId[id]);
  $('#clue-cnt').textContent = `${clues.length}개`;
  $('#clues').innerHTML = clues.map(c =>
    `<div class="clue${c.leverageTag?'':' dim'}">${c.fact}${
      state.debug && c.leverageTag ? `<span class="tag">[${c.leverageTag}]</span>`:''}</div>`).join('');
  // 이미 연 앵커 표시 갱신
  document.querySelectorAll('.anchor').forEach(b => {
    const id = b.dataset.node;
    b.classList.toggle('used', !!id && state.opened.has(id));
  });
  if (state.tickets <= 0) sysOnce('응대권을 다 썼다. 이제 의뢰서를 쓰고 도장을 찍을 수 있다.');
}
let sysDone = false;
function sysOnce(t){ if (sysDone) return; sysDone = true; sys(t); }

/* ---------- 배선 ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('.anchor');
  if (b) onAnchor(b.dataset.node || null, b.dataset.w);
});
$('#modal-cancel').onclick = () => { $('#modal').hidden = true; pendingGate = null;
  sys('그만두었다 — 응대권을 쓰지 않았다.', 'free'); };
$('#restart').onclick = boot;
$('#occ').onchange = boot;
$('#seed').onchange = boot;
$('#debug').onchange = e => { state.debug = e.target.checked; render(); };

function boot() {
  $('#log').innerHTML = ''; sysDone = false;
  start($('#occ').value, Number($('#seed').value) || 1);
  state.debug = $('#debug').checked; render();
}

fetch('../../src/data/quest-templates.json')
  .then(r => r.json())
  .then(json => { T = json; Q = T.questTypes['조사'];
    byId = Object.fromEntries(Q.nodes.map(n => [n.id, n])); boot(); })
  .catch(err => { document.body.innerHTML =
    '<p style="color:#e8d9b8">quest-templates.json을 못 읽었다. dev 서버로 열 것.<br>' + err + '</p>'; });
