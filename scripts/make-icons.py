#!/usr/bin/env python3
"""生成扩展图标：深色圆角底 + 三根递增的“温度条”（平和/火药/攻击）。
用法：python3 scripts/make-icons.py
输出：src/assets/icons/icon{16,32,48,128}.png
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG = (27, 29, 33, 255)
COLORS = [(61, 139, 107, 255), (245, 165, 36, 255), (229, 72, 77, 255)]


def draw(size: int) -> Image.Image:
    scale = 8  # 超采样，缩小后边缘干净
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(s * 0.06)
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=int(s * 0.22), fill=BG)

    # 三根柱子：短-中-长，底部对齐
    bar_w = int(s * 0.14)
    gap = int(s * 0.085)
    total = bar_w * 3 + gap * 2
    x0 = (s - total) // 2
    base = int(s * 0.76)
    heights = [0.20, 0.33, 0.46]
    for i, (h, c) in enumerate(zip(heights, COLORS)):
        x = x0 + i * (bar_w + gap)
        top = base - int(s * h)
        d.rounded_rectangle([x, top, x + bar_w, base], radius=bar_w // 2, fill=c)

    return img.resize((size, size), Image.LANCZOS)


for size in (16, 32, 48, 128):
    p = OUT / f"icon{size}.png"
    draw(size).save(p)
    print("wrote", p)
