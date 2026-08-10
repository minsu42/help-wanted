"""Normalize the approved counter object draft and render submission wireframes.

The generated sheet is source material, not a runtime atlas. This script owns the
deterministic crop, hard alpha, palette reduction, logical sizes, and previews.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design/art/source/counter-desk-objects-keyed-v1.png"
ASSETS = ROOT / "src/assets"
TARGETS = ROOT / "design/art/targets"
LOGICAL = (320, 180)
SCALE = 4

INK = "#21160e"
INK_SOFT = "#4a3220"
WOOD = "#3b2517"
WOOD_DARK = "#1b120c"
WOOD_LIGHT = "#6d4829"
PAPER = "#e8cc8f"
PAPER_DARK = "#b8884e"
SEAL = "#8b3029"
GOLD = "#c68d42"
STONE = "#262323"
MUTED = "#8a7155"


OBJECTS = {
    "counter-notebook.png": ((180, 140, 610, 450), (72, 52)),
    "counter-commission-form.png": ((650, 70, 1325, 510), (168, 80)),
    "counter-handbook.png": ((235, 555, 575, 965), (54, 62)),
    "counter-response-tools.png": ((810, 650, 1180, 910), (54, 48)),
}


def font(size: int = 8) -> ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def normalize(source: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    alpha = crop.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    crop.putalpha(alpha)
    bounds = crop.getbbox()
    if bounds is None:
        raise RuntimeError(f"empty crop: {box}")
    crop = crop.crop(bounds)
    fitted = ImageOps.contain(crop, size, method=Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(fitted, ((size[0] - fitted.width) // 2, size[1] - fitted.height))

    alpha = canvas.getchannel("A")
    rgb = Image.new("RGB", canvas.size, (255, 0, 255))
    rgb.paste(canvas.convert("RGB"), mask=alpha)
    quantized = rgb.quantize(colors=47, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    quantized.putalpha(alpha)
    return quantized


def pixel_line(draw: ImageDraw.ImageDraw, xy, fill, width: int = 1):
    draw.line(xy, fill=fill, width=width)


def base_scene(title: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", LOGICAL, WOOD_DARK)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 319, 23), fill=STONE)
    for x in range(0, 320, 32):
        draw.rectangle((x, 0, x + 30, 22), outline="#171515")
    draw.rectangle((0, 24, 319, 179), fill=WOOD)
    for y in range(32, 180, 16):
        pixel_line(draw, (0, y, 319, y), WOOD_DARK)
    for x in range(12, 320, 42):
        pixel_line(draw, (x, 24, x - 8, 179), WOOD_LIGHT)
    draw.rectangle((5, 5, 315, 19), fill=WOOD_DARK, outline=WOOD_LIGHT)
    draw.text((10, 8), title, fill=PAPER, font=font(8))
    return image, draw


def panel(draw: ImageDraw.ImageDraw, box, label: str, fill=PAPER, outline=INK_SOFT):
    draw.rectangle(box, fill=fill, outline=outline, width=2)
    draw.text((box[0] + 4, box[1] + 4), label, fill=INK, font=font(7))


def button(draw: ImageDraw.ImageDraw, box, label: str, primary=False):
    fill = GOLD if primary else WOOD_LIGHT
    draw.rectangle(box, fill=fill, outline=INK, width=2)
    draw.text((box[0] + 4, box[1] + 3), label, fill=INK if primary else PAPER, font=font(7))


def upscale(image: Image.Image) -> Image.Image:
    return image.resize((LOGICAL[0] * SCALE, LOGICAL[1] * SCALE), Image.Resampling.NEAREST)


def render_counter(assets: dict[str, Image.Image]):
    image, draw = base_scene("COUNTER / LISTEN AND RECORD")
    draw.rectangle((0, 24, 319, 86), fill=WOOD_DARK, outline=INK)
    draw.rectangle((70, 27, 249, 72), fill="#151819", outline=WOOD_LIGHT, width=2)
    portrait_sheet = Image.open(ASSETS / "client-portrait-expressions.png").convert("RGBA")
    portrait = portrait_sheet.crop((0, 0, 64, 64))
    image.paste(portrait, (128, 24), portrait)
    draw.rectangle((80, 72, 240, 87), fill=WOOD_LIGHT, outline=INK)
    draw.rectangle((87, 76, 233, 83), fill=WOOD, outline=INK_SOFT)
    image.paste(assets["counter-commission-form.png"], (76, 94), assets["counter-commission-form.png"])
    image.paste(assets["counter-notebook.png"], (3, 123), assets["counter-notebook.png"])
    image.paste(assets["counter-handbook.png"], (263, 88), assets["counter-handbook.png"])
    image.paste(assets["counter-response-tools.png"], (258, 130), assets["counter-response-tools.png"])
    draw.rectangle((75, 91, 247, 177), outline=GOLD)
    draw.rectangle((2, 121, 76, 177), outline=MUTED)
    draw.rectangle((256, 86, 318, 179), outline=MUTED)
    upscale(image).save(TARGETS / "counter-object-composite-v1.png", optimize=True)


def render_dispatch():
    image, draw = base_scene("DISPATCH / MATCH THE PARTY")
    panel(draw, (8, 30, 112, 166), "SEALED FORM")
    draw.rectangle((18, 48, 101, 114), fill="#d9bd80", outline=PAPER_DARK)
    for y in range(57, 104, 9):
        pixel_line(draw, (25, y, 92, y), MUTED)
    draw.ellipse((76, 121, 98, 143), fill=SEAL, outline=INK)
    panel(draw, (120, 30, 312, 132), "AVAILABLE ADVENTURERS", fill="#c9af79")
    for row in range(3):
        y = 48 + row * 24
        draw.rectangle((130, y, 151, y + 18), fill=WOOD_LIGHT, outline=INK)
        draw.rectangle((158, y, 294, y + 18), fill=PAPER, outline=MUTED)
        draw.rectangle((282, y + 4, 289, y + 11), outline=INK)
    button(draw, (180, 143, 310, 166), "STAMP AND DISPATCH", primary=True)
    upscale(image).save(TARGETS / "dispatch-wireframe-v1.png", optimize=True)


def render_outcome():
    image, draw = base_scene("OUTCOME / COMPARE THE RECORD")
    panel(draw, (8, 30, 155, 142), "WHAT YOU RECORDED")
    panel(draw, (165, 30, 312, 142), "WHAT HAPPENED")
    for x in (18, 175):
        for y in range(50, 126, 15):
            draw.rectangle((x, y, x + 122, y + 9), fill="#d7b978", outline=MUTED)
    draw.line((160, 37, 160, 137), fill=SEAL, width=2)
    draw.rectangle((12, 149, 238, 169), fill=WOOD_DARK, outline=WOOD_LIGHT)
    draw.text((18, 155), "CAUSE -> CONSEQUENCE", fill=PAPER, font=font(8))
    button(draw, (248, 149, 312, 169), "CONTINUE", primary=True)
    upscale(image).save(TARGETS / "outcome-wireframe-v1.png", optimize=True)


def render_hall():
    image, draw = base_scene("GUILD HALL / ASK AND REMEMBER")
    hall = Image.open(ASSETS / "hall-room.png").convert("RGB")
    hall.thumbnail((300, 116), Image.Resampling.NEAREST)
    image.paste(hall, (10, 28))
    draw.rectangle((9, 27, 310, 145), outline=GOLD, width=2)
    draw.rectangle((239, 28, 310, 145), fill=WOOD_DARK, outline=WOOD_LIGHT)
    draw.text((246, 35), "PEOPLE", fill=PAPER, font=font(8))
    for y in (52, 72, 92, 112):
        draw.rectangle((246, y, 258, y + 12), fill=PAPER_DARK, outline=INK)
        pixel_line(draw, (264, y + 4, 302, y + 4), MUTED)
        pixel_line(draw, (264, y + 9, 294, y + 9), INK_SOFT)
    panel(draw, (10, 149, 310, 174), "PORTRAIT  /  REPLY  /  ONE CLEAR ACTION", fill="#2a2118", outline=WOOD_LIGHT)
    draw.rectangle((16, 153, 34, 170), fill=PAPER_DARK, outline=INK)
    draw.text((42, 157), "MEMORY AND RUMOR LIVE HERE", fill=PAPER, font=font(8))
    upscale(image).save(TARGETS / "hall-wireframe-v1.png", optimize=True)


def render_ending():
    image, draw = base_scene("ENDING / THE LEDGER CLOSES")
    panel(draw, (34, 31, 286, 154), "GUILD LEDGER")
    draw.rectangle((48, 49, 272, 70), fill="#d8ba7b", outline=MUTED)
    for x in (55, 109, 163, 217):
        draw.rectangle((x, 55, x + 42, 64), fill=PAPER, outline=PAPER_DARK)
    draw.text((56, 83), "FATE", fill=INK_SOFT, font=font(8))
    for y in (96, 105, 114):
        pixel_line(draw, (56, y, 260, y), MUTED)
    draw.rectangle((56, 125, 260, 143), fill="#c9aa72", outline=SEAL)
    draw.text((62, 131), "MEMORIAL ROLL", fill=SEAL, font=font(8))
    button(draw, (216, 158, 286, 174), "RESTART", primary=True)
    upscale(image).save(TARGETS / "ending-wireframe-v1.png", optimize=True)


def main():
    if not SOURCE.exists():
        raise SystemExit(f"missing source: {SOURCE}")
    ASSETS.mkdir(parents=True, exist_ok=True)
    TARGETS.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    assets: dict[str, Image.Image] = {}
    for name, (box, size) in OBJECTS.items():
        asset = normalize(source, box, size)
        asset.save(ASSETS / name, optimize=True)
        assets[name] = asset
    render_counter(assets)
    render_dispatch()
    render_outcome()
    render_hall()
    render_ending()
    print("built 4 counter object candidates, 1 native-scale composite, and 4 screen wireframes")


if __name__ == "__main__":
    main()
