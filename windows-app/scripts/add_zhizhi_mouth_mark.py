#!/usr/bin/env python3
"""Add Zhizhi's small warm muzzle mark to every readable atlas face.

The source atlas is already approved transparent artwork. This repair only
blends a tiny, irregular ochre mark into the white muzzle; it never paints
outside the existing alpha-shaped sprite.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image

COLUMNS = 8
ROWS = 11
CELL_WIDTH = 192
CELL_HEIGHT = 208
MARK_COLOR = (205, 153, 83)

# The detector needs a little help for the crouched front frames where the
# largest white component is a paw, and for a loaf frame where an ear is the
# largest near-white component. Coordinates are cell-local.
OVERRIDES: dict[tuple[int, int], tuple[int, int] | None] = {
    (6, 4): (74, 101),
    (7, 2): (73, 111),
}


def white_components(cell: Image.Image) -> list[tuple[int, int, int, int, int]]:
    pixels = cell.load()
    width, _ = cell.size
    mask: set[tuple[int, int]] = set()
    for y in range(40, 141):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if (
                alpha > 170
                and min(red, green, blue) > 150
                and max(red, green, blue) - min(red, green, blue) < 85
            ):
                mask.add((x, y))

    components: list[tuple[int, int, int, int, int]] = []
    while mask:
        seed = mask.pop()
        queue = deque([seed])
        component = [seed]
        while queue:
            x, y = queue.popleft()
            for next_x in (x - 1, x, x + 1):
                for next_y in (y - 1, y, y + 1):
                    point = (next_x, next_y)
                    if point in mask:
                        mask.remove(point)
                        queue.append(point)
                        component.append(point)
        if len(component) < 20:
            continue
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        width = x1 - x0 + 1
        if 20 <= width <= 120 and y0 < 100 and y1 > 85:
            components.append((len(component), x0, x1, y0, y1))
    return components


def mark_center(cell: Image.Image, row: int, column: int) -> tuple[int, int] | None:
    if (row, column) in OVERRIDES:
        return OVERRIDES[(row, column)]
    candidates = white_components(cell)
    if not candidates:
        return None
    _, x0, x1, y0, y1 = max(candidates)
    width = x1 - x0 + 1
    fraction = 0.34 if width >= 55 else 0.40
    return round(x0 + (x1 - x0) * fraction), round(y0 + (y1 - y0) * 0.55)


def blend_mark(cell: Image.Image, center: tuple[int, int]) -> int:
    pixels = cell.load()
    center_x, center_y = center
    changed = 0
    for y in range(max(0, center_y - 7), min(CELL_HEIGHT, center_y + 8)):
        for x in range(max(0, center_x - 9), min(CELL_WIDTH, center_x + 10)):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 100:
                continue
            # Restrict the repair to the white muzzle, leaving outlines and
            # the existing tabby markings untouched.
            if min(red, green, blue) < 150 or max(red, green, blue) - min(red, green, blue) >= 90:
                continue
            dx = (x - center_x) / 6.2
            dy = (y - center_y) / 4.0
            # A deterministic low-amplitude wobble keeps the mark organic
            # instead of making it look like a perfect sticker ellipse.
            edge = 1.0 + 0.10 * (((x * 17 + y * 31) % 11) - 5) / 5
            distance = (dx * dx + dy * dy) / (edge * edge)
            if distance >= 1:
                continue
            weight = (1 - distance**0.5) ** 0.62 * 0.76
            pixels[x, y] = (
                round(red * (1 - weight) + MARK_COLOR[0] * weight),
                round(green * (1 - weight) + MARK_COLOR[1] * weight),
                round(blue * (1 - weight) + MARK_COLOR[2] * weight),
                alpha,
            )
            changed += 1
    return changed


def repair(input_path: Path, output_path: Path) -> tuple[int, int]:
    with Image.open(input_path) as opened:
        atlas = opened.convert("RGBA")
    expected_size = (COLUMNS * CELL_WIDTH, ROWS * CELL_HEIGHT)
    if atlas.size != expected_size:
        raise SystemExit(f"expected {expected_size[0]}x{expected_size[1]} atlas, got {atlas.size}")

    marked_cells = 0
    marked_pixels = 0
    for row in range(ROWS):
        for column in range(COLUMNS):
            box = (
                column * CELL_WIDTH,
                row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (row + 1) * CELL_HEIGHT,
            )
            cell = atlas.crop(box)
            center = mark_center(cell, row, column)
            if center is None:
                continue
            changed = blend_mark(cell, center)
            if changed:
                marked_cells += 1
                marked_pixels += changed
                atlas.paste(cell, box)

    # WebP can retain hidden RGB under transparent pixels. Clear it before
    # encoding so Windows/WebView2 cannot reveal a rectangular matte.
    pixels = atlas.load()
    for y in range(atlas.height):
        for x in range(atlas.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0 and (red or green or blue):
                pixels[x, y] = (0, 0, 0, 0)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # `exact=True` keeps the cleared transparent RGB values intact in Pillow's
    # WebP encoder; without it, a decoder may expose a colored matte beneath
    # alpha-zero pixels even though the sprite looks transparent in a sheet.
    atlas.save(output_path, format="WEBP", lossless=True, method=6, exact=True)
    return marked_cells, marked_pixels


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    cells, pixels = repair(args.input, args.output)
    print(f"marked {cells} cells and {pixels} muzzle pixels")


if __name__ == "__main__":
    main()
