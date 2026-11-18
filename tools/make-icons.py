"""生成 532 碳降的 PWA 图标。

设计：深绿底 + 三根 5:3:2 比例圆角柱（lime / cream / muted green）。
用 Pillow 在 1024 画布绘制后缩放，保证小尺寸也清晰。

用法：python tools/make-icons.py
"""

from PIL import Image, ImageDraw

S = 1024
OUT = "assets/icons"

TOP = (30, 92, 75)      # #1E5C4B
BOTTOM = (16, 56, 45)   # #10382D
LIME = (207, 232, 106)  # #CFE86A
CREAM = (242, 239, 230) # #F2EFE6
SAGE = (140, 192, 172)  # #8CC0AC
UNDERLINE = (242, 239, 230, 210)


def rounded_bar(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render(scale=1.0, transparent_bg=False):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if not transparent_bg:
        for y in range(S):
            t = y / (S - 1)
            c = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
            d.line([(0, y), (S, y)], fill=c + (255,))

    # 内容围绕中心缩放（maskable 用更小的 scale 留出安全区）
    cx, cy = S / 2, S / 2

    def sx(x):
        return cx + (x - cx) * scale

    def sy(y):
        return cy + (y - cy) * scale

    width, gap = 116, 46
    total = width * 3 + gap * 2
    left = cx - total / 2
    base = 748
    heights = (372, 223, 149)  # 5 : 3 : 2
    colors = (LIME, CREAM, SAGE)
    radius = 26 * scale

    for i, h in enumerate(heights):
        x0 = left + i * (width + gap)
        rounded_bar(
            d,
            [sx(x0), sy(base - h), sx(x0 + width), sy(base)],
            radius,
            colors[i],
        )

    # 底部基线
    d.rounded_rectangle(
        [sx(left), sy(base + 12), sx(left + total), sy(base + 12 + 12 * scale)],
        radius=6 * scale,
        fill=UNDERLINE,
    )

    return img


def main():
    os_ensure = __import__("os")
    os_ensure.makedirs(OUT, exist_ok=True)

    full = render(1.0)
    full.resize((512, 512), Image.LANCZOS).save(f"{OUT}/icon-512.png")
    full.resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png")
    full.resize((180, 180), Image.LANCZOS).save(f"{OUT}/apple-touch-180.png")
    full.resize((32, 32), Image.LANCZOS).save(f"{OUT}/favicon-32.png")

    mask = render(0.74)
    mask.resize((512, 512), Image.LANCZOS).save(f"{OUT}/maskable-512.png")

    print("icons written to", OUT)


if __name__ == "__main__":
    main()
