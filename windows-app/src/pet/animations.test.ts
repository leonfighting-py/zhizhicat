import { describe, expect, it } from "vitest";

import {
  ANIMATIONS,
  ATLAS,
  animationDuration,
  frameIndexAt,
} from "./animations";

describe("Zhizhi sprite atlas contract", () => {
  it("uses the approved Codex v2 atlas dimensions", () => {
    expect(ATLAS).toEqual({
      columns: 8,
      rows: 11,
      cellWidth: 192,
      cellHeight: 208,
      width: 1536,
      height: 2288,
    });
  });

  it("maps the calm first-release actions to their approved rows", () => {
    expect(ANIMATIONS.walkRight).toMatchObject({ row: 1, frames: 8, loop: true });
    expect(ANIMATIONS.walkLeft).toMatchObject({ row: 2, frames: 8, loop: true });
    expect(ANIMATIONS.wave).toMatchObject({ row: 3, frames: 4, loop: false });
    expect(ANIMATIONS.jump).toMatchObject({ row: 4, frames: 5, loop: false });
    expect(ANIMATIONS.wait).toMatchObject({ row: 6, frames: 6, loop: true });
    expect(ANIMATIONS.review).toMatchObject({ row: 8, frames: 6, loop: false });
  });

  it("keeps every used animation deliberately slow and readable", () => {
    for (const animation of Object.values(ANIMATIONS)) {
      expect(animation.frameMs).toBeGreaterThanOrEqual(140);
      expect(animation.frameMs).toBeLessThanOrEqual(280);
    }
  });

  it("loops walking but clamps one-shot reactions on their last frame", () => {
    const walking = ANIMATIONS.walkRight;
    const waving = ANIMATIONS.wave;

    expect(frameIndexAt(walking, animationDuration(walking))).toBe(0);
    expect(frameIndexAt(waving, animationDuration(waving) + 1_000)).toBe(3);
  });
});
