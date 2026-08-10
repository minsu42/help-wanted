/**
 * 빌드 산출물의 gzip 크기를 한 줄로 찍는다.
 *
 * `.claude/docs/technical-preferences.md`가 요구한 것이다: *"`npm run check`에 gzip
 * 크기 출력 한 줄을 붙인다. 매 단계가 아니라 **매 커밋에서 보이게** 하는 것이 가장
 * 싸고 놓치기 어렵다."* 로드맵은 성능 확인을 P8 한 곳에만 두고 있는데 에셋은 이미
 * 들어와 있으므로, 예산 초과를 P8에서 처음 보는 것은 구조적으로 늦다.
 *
 * ## 왜 실패시키지 않는가
 *
 * 초과해도 종료 코드는 0이다. 여기서 빌드를 깨면 `main`이 항상 배포 가능해야 한다는
 * 규칙(로드맵)과 부딪히고, 무엇보다 **예산은 판단이 필요한 값**이다 — 폰트를 넣는
 * 커밋에서 300KB가 늘어난 것은 사고가 아니라 결정일 수 있다. 이 도구의 일은
 * *"몰랐다"* 를 불가능하게 만드는 것까지다.
 *
 * 의존성 0 — `zlib`는 노드 표준 모듈이다.
 */
const { gzipSync } = require('node:zlib');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, extname } = require('node:path');

/** `.claude/docs/technical-preferences.md`의 항목별 예산 (KB, gzip 기준). */
const BUDGET_KB = { js: 200, css: 200, image: 500, font: 300 };

const DIST = join(__dirname, '..', '..', 'dist');

/** 확장자를 예산 항목으로 접는다. 모르는 확장자는 `기타`로 모아 눈에 띄게 둔다. */
function bucketOf(file) {
  const ext = extname(file).toLowerCase();
  if (ext === '.js' || ext === '.mjs') return 'js';
  if (ext === '.css') return 'css';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'font';
  if (ext === '.html') return 'html';
  return '기타';
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function main() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    console.log('[size] dist/ 가 없다 — 빌드 뒤에 실행할 것');
    return;
  }

  const totals = {};
  for (const file of files) {
    const bucket = bucketOf(file);
    // 이미 압축된 포맷(png/woff2 등)은 gzip해도 거의 안 줄지만, 전송량 기준으로
    // 보려면 같은 자로 재야 한다. 서버가 실제로 하는 일과 같다.
    totals[bucket] = (totals[bucket] || 0) + gzipSync(readFileSync(file)).length;
  }

  const parts = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([bucket, bytes]) => {
      const kb = bytes / 1024;
      const budget = BUDGET_KB[bucket];
      const mark = budget && kb > budget ? ' ⚠초과' : '';
      return `${bucket} ${kb.toFixed(2)}KB${budget ? `/${budget}` : ''}${mark}`;
    });

  const total = Object.values(totals).reduce((a, b) => a + b, 0) / 1024;
  console.log(`[size] gzip 합계 ${total.toFixed(2)}KB (초기 전송 예산 1024KB) — ${parts.join(' · ')}`);
}

main();
