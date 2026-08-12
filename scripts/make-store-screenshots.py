#!/usr/bin/env python3
"""
Compose App Store screenshots: real captures in a device frame on a branded canvas.

Input files are matched by the leading number in their filename (1.png, 2 foo.png,
"3-whatever.png"). That number is the App Store slot, so it also picks the caption.
Outputs are zero-padded (01..09) so a select-all upload lands in the right order.

Usage:
    .venv-store/bin/python scripts/make-store-screenshots.py \
        --input  ~/Desktop/store-raw-iphone \
        --output ~/Desktop/store-final-iphone \
        --device iphone

Devices: iphone (6.9", required) | iphone65 (6.5", legacy slot) | ipad (13")

Requires Pillow:  python3 -m venv .venv-store && .venv-store/bin/pip install pillow
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
FONT_BOLD = REPO_ROOT / "node_modules/@expo-google-fonts/cardo/700Bold/Cardo_700Bold.ttf"

# Apple's accepted portrait sizes (2026). 6.9" is the only required iPhone slot;
# 6.5" is what App Store Connect shows if the page hasn't moved to the new class.
DEVICES = {
    "iphone": (1320, 2868),
    "iphone65": (1284, 2778),
    "ipad": (2064, 2752),
}

# Canvas: warm parchment gradient with faint diagonal stripes, so the frame has
# something to sit against without competing with the UI inside it.
BG_TOP = (243, 234, 218)
BG_BOTTOM = (219, 203, 176)
STRIPE_COLOR = (255, 253, 247)
STRIPE_ALPHA = 34
STRIPE_STEP = 0.075
STRIPE_WIDTH = 0.022

TEXT_COLOR = (52, 44, 34)
BODY_COLOR = (28, 25, 22)
BODY_EDGE = (96, 88, 78)
BUTTON_COLOR = (58, 53, 47)
SHADOW_COLOR = (74, 56, 32)

# App Store slot -> caption. Slots 1-3 are the gameplay loop, since those are the
# only frames most people see in search results. Keep captions short so they stay
# to one or two lines.
CAPTIONS = {
    1: "Buzz in like real Certamen",   # BUZZ, question streaming
    2: "Real toss-up pacing",          # buzzed, four options
    3: "Master what you get right",    # Correct! + Hold to master
    4: "Climb 11 Roman ranks",         # Challenge, Signifer
    5: "Track streak and progress",    # Home dashboard
    6: "Review what you missed",       # Review hub
    7: "AI explains every miss",       # AI explanation
    8: "Six Certamen categories",      # Practice categories
    9: "Practice like it's real.",     # Login
}

# Fractions of canvas width/height.
CAPTION_BAND = 0.150
CAPTION_TOP = 0.050
BOTTOM_MARGIN = 0.040
SIDE_MARGIN = 0.085
BEZEL = 0.013
SCREEN_RADIUS = 0.036
SHADOW_BLUR = 0.020
SHADOW_OFFSET = 0.009


def shot_id(path: Path) -> int | None:
    match = re.match(r"\s*(\d+)", path.stem)
    return int(match.group(1)) if match else None


def build_background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    column = Image.new("RGB", (1, height))
    for y in range(height):
        t = y / max(1, height - 1)
        column.putpixel(
            (0, y),
            tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)),
        )
    canvas = column.resize(size, Image.BILINEAR).convert("RGBA")

    stripes = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(stripes)
    step = max(4, int(width * STRIPE_STEP))
    thickness = max(2, int(width * STRIPE_WIDTH))
    for x in range(-height, width + height, step):
        draw.line([(x, 0), (x + height, height)], fill=STRIPE_COLOR + (STRIPE_ALPHA,), width=thickness)

    return Image.alpha_composite(canvas, stripes).convert("RGB")


def fit_font(text: str, max_width: int, start_size: int) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Largest font size (down to 55%) where the caption fits in one or two lines."""
    words = text.split()
    size = start_size
    while size > start_size * 0.55:
        font = ImageFont.truetype(str(FONT_BOLD), size)
        if font.getlength(text) <= max_width:
            return font, [text]
        for split in range(len(words) - 1, 0, -1):
            lines = [" ".join(words[:split]), " ".join(words[split:])]
            if all(font.getlength(line) <= max_width for line in lines):
                return font, lines
        size -= 4
    return ImageFont.truetype(str(FONT_BOLD), int(start_size * 0.55)), [text]


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius, fill=255)
    return mask


def draw_side_buttons(
    canvas: Image.Image, box: tuple[int, int, int, int], bezel: int
) -> None:
    """Volume/action stack on the left, power on the right — reads as a real handset."""
    left, top, right, bottom = box
    height = bottom - top
    depth = max(3, int(bezel * 0.55))
    radius = depth
    draw = ImageDraw.Draw(canvas)

    for start, length in ((0.150, 0.048), (0.235, 0.085), (0.335, 0.085)):
        y0 = top + int(height * start)
        y1 = y0 + int(height * length)
        draw.rounded_rectangle([(left - depth, y0), (left + 1, y1)], radius, fill=BUTTON_COLOR)

    y0 = top + int(height * 0.255)
    y1 = y0 + int(height * 0.130)
    draw.rounded_rectangle([(right - 1, y0), (right + depth, y1)], radius, fill=BUTTON_COLOR)


def compose(shot: Image.Image, caption: str, canvas_size: tuple[int, int]) -> Image.Image:
    width, height = canvas_size
    canvas = build_background(canvas_size)

    band = int(height * CAPTION_BAND)
    avail_w = int(width * (1 - 2 * SIDE_MARGIN))
    avail_h = height - band - int(height * BOTTOM_MARGIN)
    bezel = max(6, int(width * BEZEL))

    # Uniform scale on both axes — never distorts the capture.
    scale = min((avail_w - 2 * bezel) / shot.width, (avail_h - 2 * bezel) / shot.height)
    shot_w, shot_h = int(shot.width * scale), int(shot.height * scale)
    shot = shot.convert("RGB").resize((shot_w, shot_h), Image.LANCZOS)

    body_w, body_h = shot_w + 2 * bezel, shot_h + 2 * bezel
    body_left = (width - body_w) // 2
    body_top = band + (avail_h - body_h) // 2
    screen_radius = int(width * SCREEN_RADIUS)
    body_radius = screen_radius + bezel

    blur = int(width * SHADOW_BLUR)
    offset = int(height * SHADOW_OFFSET)
    shadow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [(body_left, body_top + offset), (body_left + body_w, body_top + body_h + offset)],
        body_radius,
        fill=SHADOW_COLOR + (105,),
    )
    canvas = Image.alpha_composite(
        canvas.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(blur))
    ).convert("RGB")

    body_box = (body_left, body_top, body_left + body_w, body_top + body_h)
    draw_side_buttons(canvas, body_box, bezel)
    ImageDraw.Draw(canvas).rounded_rectangle(
        list(body_box), body_radius, fill=BODY_COLOR, outline=BODY_EDGE, width=max(1, bezel // 8)
    )
    canvas.paste(
        shot,
        (body_left + bezel, body_top + bezel),
        rounded_mask((shot_w, shot_h), screen_radius),
    )

    font, lines = fit_font(caption, avail_w, int(height * 0.030))
    line_h = int(font.size * 1.22)
    y = int(height * CAPTION_TOP)
    draw = ImageDraw.Draw(canvas)
    for line in lines:
        draw.text(((width - font.getlength(line)) / 2, y), line, font=font, fill=TEXT_COLOR)
        y += line_h

    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="folder of raw simulator captures")
    parser.add_argument("--output", required=True, help="folder for composed screenshots")
    parser.add_argument("--device", choices=DEVICES, default="iphone")
    args = parser.parse_args()

    if not FONT_BOLD.exists():
        print(f"Cardo not found at {FONT_BOLD} — run npm install first.", file=sys.stderr)
        return 1

    src_dir = Path(args.input).expanduser()
    out_dir = Path(args.output).expanduser()
    if not src_dir.is_dir():
        print(f"No such input folder: {src_dir}", file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)

    found: dict[int, Path] = {}
    for path in sorted(src_dir.iterdir()):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        sid = shot_id(path)
        if sid is None:
            print(f"skip (no leading number): {path.name}")
        elif sid in found:
            print(f"skip (duplicate id {sid}): {path.name}")
        else:
            found[sid] = path

    canvas_size = DEVICES[args.device]
    written = 0
    for slot in sorted(found):
        caption = CAPTIONS.get(slot)
        if caption is None:
            print(f"no caption defined for slot {slot} — skipping {found[slot].name}")
            continue
        path = found[slot]
        with Image.open(path) as raw:
            result = compose(raw, caption, canvas_size)
        # No alpha channel: App Store Connect rejects screenshots that have one.
        dest = out_dir / f"{slot:02d}_{args.device}.png"
        result.save(dest, "PNG")
        written += 1
        print(f"{slot:02d}  {path.name}  ->  {dest.name}   \"{caption}\"")

    print(f"\n{written} screenshot(s) at {canvas_size[0]}x{canvas_size[1]} in {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
