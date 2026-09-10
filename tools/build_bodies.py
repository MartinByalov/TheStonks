#!/usr/bin/env python3
"""
Пренарисува всичките 7 "candle" тела с ЕДНАКВА геометрия (wick/head/stem на
едни и същи редове), различаващи се само по цвят/нюанс. Целта: премахва
нуждата от hatOffset/faceOffset хакове - шапки, очи и лицеви черти вече
пасват на всички тела по конструкция, а не чрез компенсация.

Шаблон (24x24 canvas, същият за всички):
  wick (фитил горе):  rows 1-2,  x 9-13 (width 5)
  head (тяло):        rows 3-10, x 6-16 (width 11)
  stem (фитил долу):  rows 11-21, x 9-13 (width 5)
  очи:   черни пиксели на (9,5) и (14,5)
  уста:  черно (11,8),(12,8) + бяло (11,9)
  сянка: най-лявата колона на всеки сегмент е с по-тъмен нюанс (леко 3D)
"""
from PIL import Image

N = 24
WICK_ROWS = (1, 2)
HEAD_ROWS = (3, 10)
STEM_ROWS = (11, 21)
WICK_X = (9, 13)
HEAD_X = (6, 16)
STEM_X = (9, 13)
EYES = [(9, 5), (14, 5)]
MOUTH_BLACK = [(11, 8), (12, 8)]
MOUTH_WHITE = [(11, 9)]

def scale(color, factor):
    return tuple(min(255, max(0, int(c * factor))) for c in color)

def build_body(main_rgb, shade_rgb, border_rgb=None):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    px = img.load()

    def fill_segment(rows, xs):
        y0, y1 = rows
        x0, x1 = xs
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                color = shade_rgb if x == x0 else main_rgb
                px[x, y] = (*color, 255)

    fill_segment(WICK_ROWS, WICK_X)
    fill_segment(HEAD_ROWS, HEAD_X)
    fill_segment(STEM_ROWS, STEM_X)

    for (x, y) in EYES:
        px[x, y] = (0, 0, 0, 255)
    for (x, y) in MOUTH_BLACK:
        px[x, y] = (0, 0, 0, 255)
    for (x, y) in MOUTH_WHITE:
        px[x, y] = (255, 255, 255, 255)

    if border_rgb:
        # добавя 1px рамка около силуета (8-посочно), само върху прозрачни пиксели
        solid = [(x, y) for y in range(N) for x in range(N) if px[x, y][3] > 0]
        border_pixels = set()
        for (x, y) in solid:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and 0 <= ny < N and px[nx, ny][3] == 0:
                        border_pixels.add((nx, ny))
        for (x, y) in border_pixels:
            px[x, y] = (*border_rgb, 255)

    return img

PALETTES = {
    "greencandle1": (dict(main=(30, 230, 86), shade=(34, 177, 76))),
    "greencandle2": (dict(main=scale((30, 230, 86), 0.82), shade=scale((34, 177, 76), 0.82))),
    "greencandle3": (dict(main=scale((30, 230, 86), 1.12), shade=scale((34, 177, 76), 1.12))),
    "redcandle1":   (dict(main=(237, 28, 36), shade=(196, 4, 36))),
    "redcandle2":   (dict(main=scale((237, 28, 36), 0.82), shade=scale((196, 4, 36), 0.82))),
    "redcandle3":   (dict(main=scale((237, 28, 36), 1.1), shade=scale((196, 4, 36), 1.1))),
    "goldencandle1": (dict(main=(255, 217, 0), shade=(255, 201, 14), border=(195, 195, 195))),
}

if __name__ == "__main__":
    import os
    out_dir = "assets/body"
    os.makedirs(out_dir, exist_ok=True)
    for name, pal in PALETTES.items():
        img = build_body(pal["main"], pal["shade"], pal.get("border"))
        img.save(f"{out_dir}/{name}.png")
        print("написано:", f"{out_dir}/{name}.png")
