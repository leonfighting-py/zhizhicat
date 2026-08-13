import { describe, expect, it } from "vitest";

import { animationDuration, ANIMATIONS } from "./animations";
import {
  animationForState,
  createPetState,
  reducePetState,
} from "./machine";

const lowestRandom = () => 0;
const middleRandom = () => 0.5;
const highestRandom = () => 0.999_999;

describe("Zhizhi behavior state machine", () => {
  it("starts walking in the persisted direction and schedules a bounded rest", () => {
    const earliest = createPetState(1_000, "left", false, lowestRandom);
    const latest = createPetState(1_000, "right", false, highestRandom);

    expect(earliest).toMatchObject({
      mode: "walking",
      direction: "left",
      action: "walkLeft",
      deadlineMs: 9_000,
    });
    expect(latest.deadlineMs).toBeGreaterThanOrEqual(18_999);
    expect(latest.deadlineMs).toBeLessThanOrEqual(19_000);
  });

  it("turns around only after the native shell reports an edge", () => {
    const initial = createPetState(0, "right", false, lowestRandom);
    const normalTick = reducePetState(initial, { type: "tick", now: 1_000 }, lowestRandom);
    const atEdge = reducePetState(normalTick, { type: "edge", now: 1_001 }, lowestRandom);

    expect(normalTick.direction).toBe("right");
    expect(atEdge).toMatchObject({ direction: "left", action: "walkLeft" });
  });

  it("uses one calm pose for 3-8 seconds, then resumes the same direction", () => {
    const walking = createPetState(0, "right", false, lowestRandom);
    const resting = reducePetState(walking, { type: "tick", now: 8_000 }, lowestRandom);
    const resumed = reducePetState(resting, { type: "tick", now: 11_000 }, lowestRandom);

    expect(resting).toMatchObject({
      mode: "resting",
      direction: "right",
      action: "idle",
      deadlineMs: 11_000,
    });
    expect(resumed).toMatchObject({
      mode: "walking",
      direction: "right",
      action: "walkRight",
      deadlineMs: 19_000,
    });
  });

  it("chooses one short click reaction and returns to walking", () => {
    const walking = createPetState(0, "right", false, middleRandom);
    const reacting = reducePetState(walking, { type: "click", now: 2_000 }, middleRandom);

    expect(reacting).toMatchObject({
      mode: "reacting",
      action: "jump",
      resumeMode: "walking",
      deadlineMs: 2_000 + animationDuration(ANIMATIONS.jump),
    });

    const resumed = reducePetState(
      reacting,
      { type: "tick", now: reacting.deadlineMs! },
      lowestRandom,
    );
    expect(resumed).toMatchObject({ mode: "walking", action: "walkRight" });
  });

  it("does not stack clicks while a reaction is playing", () => {
    const walking = createPetState(0, "left", false, lowestRandom);
    const first = reducePetState(walking, { type: "click", now: 200 }, lowestRandom);
    const second = reducePetState(first, { type: "click", now: 300 }, highestRandom);

    expect(second).toEqual(first);
    expect(second.action).toBe("wave");
  });

  it("pauses without adding a dance and can react before returning to pause", () => {
    const walking = createPetState(0, "right", false, lowestRandom);
    const paused = reducePetState(
      walking,
      { type: "setPaused", paused: true, now: 100 },
      lowestRandom,
    );
    const reacting = reducePetState(paused, { type: "click", now: 200 }, highestRandom);
    const afterReaction = reducePetState(
      reacting,
      { type: "tick", now: reacting.deadlineMs! },
      lowestRandom,
    );

    expect(paused).toMatchObject({ mode: "paused", action: "idle", deadlineMs: null });
    expect(reacting).toMatchObject({ action: "review", resumeMode: "paused" });
    expect(afterReaction).toMatchObject({ mode: "paused", action: "idle" });
  });

  it("suspends walking during drag and settles briefly after release", () => {
    const walking = createPetState(0, "left", false, lowestRandom);
    const dragging = reducePetState(walking, { type: "dragStart", now: 100 }, lowestRandom);
    const settling = reducePetState(dragging, { type: "dragEnd", now: 500 }, lowestRandom);
    const resumed = reducePetState(settling, { type: "tick", now: 2_000 }, lowestRandom);

    expect(dragging).toMatchObject({ mode: "dragging", action: "idle", resumeMode: "walking" });
    expect(settling).toMatchObject({ mode: "settling", action: "idle", deadlineMs: 2_000 });
    expect(resumed).toMatchObject({ mode: "walking", action: "walkLeft" });
  });

  it("keeps a paused pet paused after dragging", () => {
    const paused = createPetState(0, "right", true, lowestRandom);
    const dragging = reducePetState(paused, { type: "dragStart", now: 50 }, lowestRandom);
    const released = reducePetState(dragging, { type: "dragEnd", now: 100 }, lowestRandom);

    expect(released).toMatchObject({ mode: "paused", action: "idle", deadlineMs: null });
  });

  it("exposes the animation definition for the renderer", () => {
    const left = createPetState(0, "left", false, lowestRandom);
    expect(animationForState(left)).toBe(ANIMATIONS.walkLeft);
  });
});
