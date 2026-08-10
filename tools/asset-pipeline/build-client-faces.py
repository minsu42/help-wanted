"""의뢰인 초상 아틀라스를 굽는다.

CC0 `Ninja Adventure Asset Pack`의 Faceset 6장을 가로로 이어 붙여
`src/assets/client-faces.png` 한 장으로 만든다. 팩 전체를 저장소에 붓지 않고
실제로 쓰는 조각만 구워 넣는 것이 이 프로젝트의 에셋 규약이다.

원본 zip은 gitignore 대상이므로 저장소 루트에 두고 실행한다.

    python tools/asset-pipeline/build-client-faces.py
"""

import os
import struct
import sys
import zipfile
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACK = os.path.join(ROOT, "Ninja Adventure - Asset Pack.zip")
OUT = os.path.join(ROOT, "src", "assets", "client-faces.png")

# 화면 순서 = ClientCase.portraitIndex. 직업과 태도에 맞춰 고른 배역이다.
CAST = [
    ("Woman", "마라 · 양조장 주인"),
    ("Noble", "베른 · 교역상"),
    ("Villager", "루엔 · 목동"),
    ("OldMan", "오르사 · 석교지기"),
    ("Hunter", "세라드 · 늪지 순찰자"),
    ("SorcererOrange", "티아 · 마법사 조합 견습생"),
]

FRAME = 38


def read_png(data):
    """PNG를 (width, height, RGBA bytes)로 푼다. Pillow 없이 zlib만 쓴다."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("PNG가 아니다")
    pos, idat, palette, trns = 8, b"", None, None
    width = height = depth = color = 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if tag == b"IHDR":
            width, height, depth, color = struct.unpack(">IIBB", body[:10])
        elif tag == b"PLTE":
            palette = body
        elif tag == b"tRNS":
            trns = body
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        pos += 12 + length
    if depth != 8:
        raise ValueError("8비트 채널만 지원한다: depth=%d" % depth)

    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    raw = zlib.decompress(idat)
    stride = width * channels
    out = bytearray(stride * height)
    prev = bytearray(stride)
    src = 0
    for y in range(height):
        filt = raw[src]
        src += 1
        line = bytearray(raw[src:src + stride])
        src += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 0xFF
            elif filt == 2:
                line[x] = (line[x] + b) & 0xFF
            elif filt == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 0xFF
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line

    rgba = bytearray(width * height * 4)
    for i in range(width * height):
        if color == 6:
            rgba[i * 4:i * 4 + 4] = out[i * 4:i * 4 + 4]
        elif color == 2:
            rgba[i * 4:i * 4 + 3] = out[i * 3:i * 3 + 3]
            rgba[i * 4 + 3] = 255
        elif color == 3:
            idx = out[i]
            rgba[i * 4:i * 4 + 3] = palette[idx * 3:idx * 3 + 3]
            rgba[i * 4 + 3] = trns[idx] if trns and idx < len(trns) else 255
        elif color == 0:
            rgba[i * 4:i * 4 + 3] = bytes([out[i]]) * 3
            rgba[i * 4 + 3] = 255
        elif color == 4:
            rgba[i * 4:i * 4 + 3] = bytes([out[i * 2]]) * 3
            rgba[i * 4 + 3] = out[i * 2 + 1]
    return width, height, rgba


def write_png(path, width, height, rgba):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw += rgba[y * width * 4:(y + 1) * width * 4]

    def chunk(tag, body):
        return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)


def main():
    if not os.path.exists(PACK):
        sys.exit("원본 팩이 없다: %s" % PACK)
    pack = zipfile.ZipFile(PACK)
    names = {n.split("/")[-2] + "/" + n.split("/")[-1]: n for n in pack.namelist() if "/Character/" in n}

    sheet_w = FRAME * len(CAST)
    sheet = bytearray(sheet_w * FRAME * 4)
    for index, (actor, role) in enumerate(CAST):
        key = next((k for k in (actor + "/Faceset.png", actor + "/Faceset1.png") if k in names), None)
        if key is None:
            sys.exit("배역을 찾지 못했다: %s" % actor)
        width, height, rgba = read_png(pack.read(names[key]))
        # 38×38이 아닌 변형이 섞여 있으므로 좌상단 기준으로 프레임에 맞춰 자른다.
        for y in range(min(height, FRAME)):
            for x in range(min(width, FRAME)):
                src = (y * width + x) * 4
                dst = (y * sheet_w + index * FRAME + x) * 4
                sheet[dst:dst + 4] = rgba[src:src + 4]
        print("  [%d] %-16s %s (%dx%d)" % (index, actor, role, width, height))

    write_png(OUT, sheet_w, FRAME, sheet)
    print("구움: %s (%dx%d, %d bytes)" % (OUT, sheet_w, FRAME, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()
