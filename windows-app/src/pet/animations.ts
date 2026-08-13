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
  frameDurations?: readonly number[];
  loop: boolean;
}

// The idle strip contains three relaxed blink poses. Keep the open-eye frames
// long and the closed-eye frames brief: this gives roughly five calm blink
// moments per minute without leaving a closed pose on screen.
const IDLE_FRAME_DURATIONS = [12_000, 180, 12_000, 180, 12_000, 180] as const;

export const ANIMATIONS: Record<AnimationName, AnimationDefinition> = {
  idle: {
    row: 0,
    frames: 6,
    frameMs: 12_000,
    frameDurations: IDLE_FRAME_DURATIONS,
    loop: true,
  },
  walkRight: { row: 1, frames: 8, frameMs: 150, loop: true },
  walkLeft: { row: 2, frames: 8, frameMs: 150, loop: true },
  wave: { row: 3, frames: 4, frameMs: 220, loop: false },
  jump: { row: 4, frames: 5, frameMs: 180, loop: false },
  wait: { row: 6, frames: 6, frameMs: 260, loop: true },
  review: { row: 8, frames: 6, frameMs: 230, loop: false },
};

export function animationDuration(animation: AnimationDefinition): number {
  return animation.frameDurations?.reduce((total, duration) => total + duration, 0) ??
    animation.frames * animation.frameMs;
}

export function frameIndexAt(
  animation: AnimationDefinition,
  elapsedMs: number,
): number {
  if (animation.frameDurations) {
    const totalDuration = animationDuration(animation);
    let remaining = Math.max(0, elapsedMs);

    if (animation.loop) {
      remaining %= totalDuration;
    } else {
      remaining = Math.min(remaining, totalDuration - 1);
    }

    for (const [index, duration] of animation.frameDurations.entries()) {
      if (remaining < duration) return index;
      remaining -= duration;
    }

    return animation.frameDurations.length - 1;
  }

  const rawFrame = Math.floor(Math.max(0, elapsedMs) / animation.frameMs);
  return animation.loop
    ? rawFrame % animation.frames
    : Math.min(rawFrame, animation.frames - 1);
}
