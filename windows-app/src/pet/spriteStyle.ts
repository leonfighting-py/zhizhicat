import type { CSSProperties } from "react";

import { ATLAS } from "./animations";

const BASE_DISPLAY_SCALE = 1.35;

function pixels(value: number): string {
  return `${Number(value.toFixed(4))}px`;
}

export function spriteStyle(
  frame: number,
  row: number,
  sizeScale: number,
): CSSProperties {
  const scale = BASE_DISPLAY_SCALE * sizeScale;

  return {
    width: pixels(ATLAS.cellWidth * scale),
    height: pixels(ATLAS.cellHeight * scale),
    backgroundImage: "url('/pets/zhizhi/spritesheet.webp')",
    backgroundRepeat: "no-repeat",
    backgroundSize: `${pixels(ATLAS.width * scale)} ${pixels(ATLAS.height * scale)}`,
    backgroundPosition: `${pixels(-frame * ATLAS.cellWidth * scale)} ${pixels(-row * ATLAS.cellHeight * scale)}`,
  };
}
