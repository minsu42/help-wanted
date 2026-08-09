/**
 * 길드 홀 에셋을 굽는다 — 방 배경 한 장, 인물 아틀라스 두 장, UI 9-slice 몇 장.
 *
 * ## 왜 원본 팩을 저장소에 두지 않는가
 *
 * Ninja Adventure 팩은 94MB이고 우리가 쓰는 것은 그중 30KB도 되지 않는다. 원본을
 * 커밋하면 클론이 무거워지고, 무엇보다 **쓰지 않는 에셋이 섞여 들어가 나중에 무엇이
 * 실제로 쓰이는지 아무도 모르게 된다.** 이 도구가 필요한 조각만 뽑아 `src/assets/`에
 * 내보내고, 원본 팩 경로는 인자로 받는다.
 *
 * ```
 * node tools/asset-pipeline/build-hall-assets.cjs "<압축 푼 팩 경로>"
 * ```
 *
 * 출처와 라이선스(CC0)는 `docs/asset-credits.md`에 있다.
 *
 * ## 왜 방을 런타임에 조립하지 않는가
 *
 * 방은 정적이다. 타일을 매 렌더마다 배치하면 DOM 노드가 수백 개로 늘고 얻는 것이
 * 없다. 한 장으로 구우면 배경 하나로 끝나고 파일도 7KB다. 움직이는 것은 사람뿐이며
 * 그들만 별도 스프라이트로 얹는다.
 *
 * ## 자리 좌표가 여기서 나오는 이유
 *
 * 의자를 놓은 코드와 사람을 앉히는 코드가 다르면 반드시 어긋난다. 가구를 배치한 이
 * 파일이 좌표의 유일한 출처이고, 결과를 `src/data/hall-layout.json`으로 내보낸다.
 */
const fs = require('fs');
const path = require('path');
const P = require('./png.cjs');

const PACK = process.argv[2];
if (!PACK || !fs.existsSync(PACK)) {
  console.error('압축 푼 Ninja Adventure 팩 경로를 인자로 넘길 것.');
  console.error('예: node tools/asset-pipeline/build-hall-assets.cjs "D:/Ninja Adventure - Asset Pack"');
  process.exit(1);
}

const OUT_ASSETS = path.join(__dirname, '..', '..', 'src', 'assets');
const OUT_DATA = path.join(__dirname, '..', '..', 'src', 'data');
fs.mkdirSync(OUT_ASSETS, { recursive: true });

const T = 16;
const TS = path.join(PACK, 'Backgrounds', 'Tilesets');
const sheets = {
  floor: P.decode(path.join(TS, 'Interior', 'TilesetInteriorFloor.png')),
  wall: P.decode(path.join(TS, 'Interior', 'TilesetWallSimple.png')),
  elem: P.decode(path.join(TS, 'TilesetElement.png')),
};

const canvas = (w, h) => ({ width: w, height: h, data: Buffer.alloc(w * h * 4) });

/** 알파 합성. 투명 픽셀이 아래를 지우면 가구에 사각 구멍이 남는다. */
function blit(dst, src, sx, sy, sw, sh, dx, dy) {
  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const X = dx + i, Y = dy + j;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      if (sy + j >= src.height || sx + i >= src.width || sx + i < 0 || sy + j < 0) continue;
      const s = ((sy + j) * src.width + (sx + i)) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = (Y * dst.width + X) * 4;
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
      }
      dst.data[d + 3] = Math.max(dst.data[d + 3], src.data[s + 3]);
    }
  }
}

const tile = (dst, sheet, tx, ty, dx, dy, w = 1, h = 1) =>
  blit(dst, sheets[sheet], tx * T, ty * T, w * T, h * T, dx * T, dy * T);

// ─────────────────────────────────────────────────────────────────────────────
// 방
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 31;
const ROWS = 16;
const room = canvas(COLS * T, ROWS * T);

// 바닥 — 어두운 석재 5종을 섞는다. 한 장만 반복하면 격자가 눈에 밟힌다.
const FLOOR = [[12, 13], [13, 13], [14, 13], [12, 14], [13, 14]];
for (let y = 2; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    const f = FLOOR[(x * 7 + y * 3) % FLOOR.length];
    tile(room, 'floor', f[0], f[1], x, y);
  }
}

// 벽 — 원래 링은 1칸 두께다. 갓돌(2,6)과 굽(2,10)을 겹쳐 쌓아 홀다운 높이를 만든다.
for (let x = 0; x < COLS; x++) tile(room, 'wall', 2, 6, x, 0);
for (let x = 0; x < COLS; x++) tile(room, 'wall', 2, 10, x, 1);
tile(room, 'wall', 0, 6, 0, 0);
tile(room, 'wall', 4, 6, COLS - 1, 0);
tile(room, 'wall', 1, 7, 4, 1);
tile(room, 'wall', 1, 7, COLS - 5, 1);

const HEARTH_X = Math.floor(COLS / 2);
tile(room, 'elem', 12, 0, HEARTH_X, 1); // 화덕. 방의 중심이자 유일한 광원
for (const bx of [8, COLS - 9]) {
  tile(room, 'elem', 15, 2, bx, 1);
  tile(room, 'elem', 15, 3, bx, 2);
}

// 중앙 양탄자 — 주 탁자가 올라앉는 자리
for (let j = 0; j < 4; j++) {
  for (let i = 0; i < 5; i++) tile(room, 'elem', 13 + (i % 3), 4 + (j % 3), HEARTH_X - 2 + i, 3 + j);
}

const guildSeats = [];
const visitorSeats = [];

/**
 * 탁자 하나와 그 둘레. 삼삼오오의 최소 단위다.
 *
 * 쿠션 벤치(11,1)와 가대식 탁자(11,2)는 **서로 다른 가구다.** 겹쳐 쌓으면 상판이
 * 공중에 뜬 것처럼 보인다 — 벤치는 탁자 위아래에 따로 놓는다.
 */
function tableGroup(cx, cy, into) {
  tile(room, 'elem', 11, 2, cx, cy, 3, 2);
  tile(room, 'elem', 11, 1, cx, cy - 1, 3, 1);
  tile(room, 'elem', 11, 1, cx, cy + 2, 3, 1);
  tile(room, 'elem', 11, 0, cx - 1, cy);
  tile(room, 'elem', 11, 0, cx + 3, cy);
  into.push([cx, cy - 1], [cx + 2, cy - 1], [cx - 1, cy + 1], [cx + 3, cy + 1], [cx + 1, cy + 3]);
}

// **자리 순서가 곧 채워지는 순서다.** 홀 출석은 많아야 6명이므로, 넓은 방에 흩뿌리면
// 텅 빈 것처럼 보인다. 화덕 아래 주 탁자부터 채워 무리가 먼저 생기게 한다.
tableGroup(HEARTH_X - 1, 5, guildSeats);
tableGroup(4, 10, guildSeats);

// 외부인은 문가(아래쪽)에 선다. 배지를 읽기 전에 자리로 먼저 읽힌다.
tableGroup(21, 12, visitorSeats);

// 벽면 살림
tile(room, 'elem', 3, 7, 1, 2, 2, 2);
tile(room, 'elem', 8, 7, COLS - 3, 2, 2, 2);
tile(room, 'elem', 1, 0, 9, 13);
tile(room, 'elem', 0, 11, 10, 13);
tile(room, 'elem', 1, 0, COLS - 2, 6);
tile(room, 'elem', 0, 7, COLS - 4, 9);
tile(room, 'elem', 0, 7, 1, 6);
tile(room, 'elem', 2, 10, 25, 4, 3, 1);

const roomBytes = P.encode(room, path.join(OUT_ASSETS, 'hall-room.png'));

// ─────────────────────────────────────────────────────────────────────────────
// 인물 아틀라스
//
// 인물마다 파일 두 개씩 두면 30명에 60개다. 한 줄로 이어 붙이면 파일 두 장이고,
// 화면은 `background-position`으로 사람을 고른다.
// ─────────────────────────────────────────────────────────────────────────────
const CAST = [
  'Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'Villager6',
  'Woman', 'OldMan', 'OldMan2', 'OldMan3', 'OldWoman', 'Boy',
  'Child', 'Hunter', 'Knight', 'KnightGold', 'Monk', 'Monk2',
  'Noble', 'Master', 'Shaman', 'Inspector', 'FighterRed', 'FighterWhite',
];

const FACE = 38;
const sprites = canvas(CAST.length * T, T);
const faces = canvas(CAST.length * FACE, FACE);

CAST.forEach((name, i) => {
  const dir = path.join(PACK, 'Actor', 'Character', name);
  // 첫 프레임 = 정면 대기. 홀에서는 아무도 걷지 않으므로 이 한 장이면 된다.
  blit(sprites, P.decode(path.join(dir, 'SpriteSheet.png')), 0, 0, T, T, i * T, 0);
  blit(faces, P.decode(path.join(dir, 'Faceset.png')), 0, 0, FACE, FACE, i * FACE, 0);
});

const spriteBytes = P.encode(sprites, path.join(OUT_ASSETS, 'cast-sprites.png'));
const faceBytes = P.encode(faces, path.join(OUT_ASSETS, 'cast-faces.png'));

// ─────────────────────────────────────────────────────────────────────────────
// UI 9-slice — 나무 틀. 원본을 그대로 복사한다 (가공할 것이 없다)
// ─────────────────────────────────────────────────────────────────────────────
const UI = {
  'ui-panel.png': 'nine_path_panel.png',
  'ui-inset.png': 'nine_path_bg.png',
  'ui-button.png': 'button_normal.png',
  'ui-button-hover.png': 'button_hover.png',
  'ui-button-disabled.png': 'button_disabled.png',
};
let uiBytes = 0;
for (const [out, src] of Object.entries(UI)) {
  const from = path.join(PACK, 'Ui', 'Theme', 'Theme Wood', src);
  fs.copyFileSync(from, path.join(OUT_ASSETS, out));
  uiBytes += fs.statSync(path.join(OUT_ASSETS, out)).size;
}

// ─────────────────────────────────────────────────────────────────────────────
// 배치 데이터
// ─────────────────────────────────────────────────────────────────────────────
const layout = {
  _comment:
    '길드 홀 배치. tools/asset-pipeline/build-hall-assets.cjs가 생성한다 — 손으로 고치지 말 것. ' +
    '좌표는 칸(tile) 단위이고, seats 순서가 곧 사람이 채워지는 순서다. ' +
    '밸런스 수치가 아니라 배치 상수이므로 balance.json이 아니라 여기 있다.',
  cols: COLS,
  rows: ROWS,
  tile: T,
  castCount: CAST.length,
  faceSize: FACE,
  guildSeats,
  visitorSeats,
};
fs.writeFileSync(path.join(OUT_DATA, 'hall-layout.json'), JSON.stringify(layout, null, 2) + '\n');

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`방        ${room.width}x${room.height}  ${kb(roomBytes)}`);
console.log(`스프라이트 ${sprites.width}x${sprites.height}  ${kb(spriteBytes)}  (${CAST.length}명)`);
console.log(`얼굴      ${faces.width}x${faces.height}  ${kb(faceBytes)}`);
console.log(`UI        ${Object.keys(UI).length}장  ${kb(uiBytes)}`);
console.log(`합계      ${kb(roomBytes + spriteBytes + faceBytes + uiBytes)}`);
console.log(`자리      길드원 ${guildSeats.length} · 외부인 ${visitorSeats.length}`);
