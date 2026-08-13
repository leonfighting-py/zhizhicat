export const ATLAS = {
  columns: 8,
  rows: 11,
  cellWidth: 192,
  cellHeight: 208,
  width: 1536,
  height: 2288,
} as const;

export type AnimationName =
  | "idle"
  | "walkRight"
  | "walkLeft"
  | "wave"
  | "jump"
  | "wait"
  | "review";

export interface AnimationDefinition {
  row: number;
  frames: number;
  frameMs: number;
  loop: boolean;
}

export const ANIMATIONS: Record<AnimationName, AnimationDefinition> = {
  idle: { row: 0, frames: 6, frameMs: 240, loop: true },
  walkRight: { row: 1, frames: 8, frameMs: 150, loop: true },
  walkLeft: { row: 2, frames: 8, frameMs: 150, loop: true },
  wave: { row: 3, frames: 4, frameMs: 220, loop: false },
  jump: { row: 4, frames: 5, frameMs: 180, loop: false },
  wait: { row: 6, frames: 6, frameMs: 260, loop: true },
  review: { row: 8, frames: 6, frameMs: 230, loop: false },
};

export function animationDuration(animation: AnimationDefinition): number {
  return animation.frames * animation.frameMs;
}

export function frameIndexAt(
  animation: AnimationDefinition,
  elapsedMs: number,
): number {
  const rawFrame = Math.floor(Math.max(0, elapsedMs) / animation.frameMs);
  return animation.loop
    ? rawFrame % animation.frames
    : Math.min(rawFrame, animation.frames - 1);
}
