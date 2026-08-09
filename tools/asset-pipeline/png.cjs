/**
 * 의존성 없는 최소 PNG 도구 — 디코드 / 크롭 / 최근접 확대 / 인코드.
 *
 * 타일셋에서 쓸 조각만 골라내고, 작은 픽셀 이미지를 눈으로 확인할 수 있게 키운다.
 * 런타임 의존성 0 규칙은 게임 번들에만 적용되지만, 빌드 도구도 굳이 늘리지 않는다.
 */
const fs = require('fs');
const zlib = require('zlib');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** PNG를 {width, height, data(RGBA)}로 푼다. 인터레이스는 지원하지 않는다. */
function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let ihdr = null;
  const idat = [];
  let plte = null;
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        color: body[9],
        interlace: body[12],
      };
    } else if (type === 'PLTE') plte = Buffer.from(body);
    else if (type === 'tRNS') trns = Buffer.from(body);
    else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  if (ihdr.interlace !== 0) throw new Error('인터레이스 PNG는 지원하지 않는다: ' + file);
  if (ihdr.depth !== 8) throw new Error('8비트 심도만 지원한다: ' + file + ' (depth ' + ihdr.depth + ')');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (channels === undefined) throw new Error('지원하지 않는 colorType: ' + ihdr.color);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width, height } = ihdr;
  const bpp = channels;
  const stride = width * bpp;
  const lines = Buffer.alloc(height * stride);

  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const cur = lines.subarray(y * stride, (y + 1) * stride);
    raw.copy(cur, 0, rp, rp + stride);
    rp += stride;
    const prev = y > 0 ? lines.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
  }

  // 어떤 색 형식이든 RGBA로 정규화한다 — 이후 단계가 형식을 몰라도 되게.
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * bpp, d = i * 4;
    if (ihdr.color === 6) { lines.copy(out, d, s, s + 4); }
    else if (ihdr.color === 2) { lines.copy(out, d, s, s + 3); out[d + 3] = 255; }
    else if (ihdr.color === 0) { out[d] = out[d + 1] = out[d + 2] = lines[s]; out[d + 3] = 255; }
    else if (ihdr.color === 4) { out[d] = out[d + 1] = out[d + 2] = lines[s]; out[d + 3] = lines[s + 1]; }
    else if (ihdr.color === 3) {
      const idx = lines[s];
      out[d] = plte[idx * 3]; out[d + 1] = plte[idx * 3 + 1]; out[d + 2] = plte[idx * 3 + 2];
      out[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, data: out };
}

function encode(img, file) {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
  return fs.statSync(file).size;
}

function crop(img, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= img.height) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= img.width) continue;
      img.data.copy(out, (j * w + i) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
    }
  }
  return { width: w, height: h, data: out };
}

/** 최근접 확대. 픽셀 아트는 보간하면 안 된다 — 눈으로 확인할 때도 마찬가지다. */
function scale(img, n) {
  const w = img.width * n, h = img.height * n;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / n) * img.width + Math.floor(x / n)) * 4;
      img.data.copy(out, (y * w + x) * 4, s, s + 4);
    }
  }
  return { width: w, height: h, data: out };
}

/** 격자선을 그어 타일 경계를 눈으로 셀 수 있게 한다. 좌표를 알아내려면 이게 있어야 한다. */
function grid(img, step, color = [255, 0, 128, 200]) {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  const put = (x, y) => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
    const d = (y * out.width + x) * 4;
    out.data[d] = color[0]; out.data[d + 1] = color[1]; out.data[d + 2] = color[2]; out.data[d + 3] = color[3];
  };
  for (let x = 0; x < out.width; x += step) for (let y = 0; y < out.height; y++) put(x, y);
  for (let y = 0; y < out.height; y += step) for (let x = 0; x < out.width; x++) put(x, y);
  return out;
}

/** 투명 배경을 체크무늬로 채운다. 검은 배경 위 검은 픽셀을 구분하려면 필요하다. */
function checker(img, size = 8, a = [58, 44, 30, 255], b = [42, 32, 22, 255]) {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const d = (y * out.width + x) * 4;
      const alpha = out.data[d + 3] / 255;
      if (alpha === 1) continue;
      const bg = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? a : b;
      for (let c = 0; c < 3; c++) out.data[d + c] = Math.round(out.data[d + c] * alpha + bg[c] * (1 - alpha));
      out.data[d + 3] = 255;
    }
  }
  return out;
}

module.exports = { decode, encode, crop, scale, grid, checker };
