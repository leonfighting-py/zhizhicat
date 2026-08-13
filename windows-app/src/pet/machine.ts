import {
  ANIMATIONS,
  animationDuration,
  type AnimationDefinition,
  type AnimationName,
} from "./animations";
import { randomBetween, randomItem, type RandomSource } from "./random";

export type Direction = "left" | "right";
export type PetMode =
  | "walking"
  | "resting"
  | "reacting"
  | "paused"
  | "dragging"
  | "settling";
export type ResumeMode = "walking" | "paused";

export interface PetState {
  mode: PetMode;
  direction: Direction;
  action: AnimationName;
  deadlineMs: number | null;
  resumeMode: ResumeMode;
  actionStartedMs: number;
}

export type PetEvent =
  | { type: "tick"; now: number }
  | { type: "edge"; now: number }
  | { type: "click"; now: number }
  | { type: "setPaused"; paused: boolean; now: number }
  | { type: "dragStart"; now: number }
  | { type: "dragEnd"; now: number };

const WALK_MIN_MS = 8_000;
const WALK_MAX_MS = 18_000;
const REST_MIN_MS = 3_000;
const REST_MAX_MS = 8_000;
const DRAG_SETTLE_MS = 1_500;

const REST_ACTIONS = ["idle", "wait", "review"] as const;
const REACTION_ACTIONS = ["wave", "jump", "review"] as const;

function walkingAction(direction: Direction): AnimationName {
  return direction === "left" ? "walkLeft" : "walkRight";
}

function scheduleWalking(
  state: PetState,
  now: number,
  random: RandomSource,
): PetState {
  return {
    ...state,
    mode: "walking",
    action: walkingAction(state.direction),
    actionStartedMs: now,
    deadlineMs: now + randomBetween(WALK_MIN_MS, WALK_MAX_MS, random),
    resumeMode: "walking",
  };
}

function pause(state: PetState, now: number): PetState {
  return {
    ...state,
    mode: "paused",
    action: "idle",
    actionStartedMs: now,
    deadlineMs: null,
    resumeMode: "paused",
  };
}

export function createPetState(
  now: number,
  direction: Direction,
  paused: boolean,
  random: RandomSource = Math.random,
): PetState {
  const initial: PetState = {
    mode: "walking",
    direction,
    action: walkingAction(direction),
    deadlineMs: null,
    resumeMode: "walking",
    actionStartedMs: now,
  };
  return paused ? pause(initial, now) : scheduleWalking(initial, now, random);
}

export function reducePetState(
  state: PetState,
  event: PetEvent,
  random: RandomSource = Math.random,
): PetState {
  if (event.type === "setPaused") {
    if (event.paused) return pause(state, event.now);
    return scheduleWalking(state, event.now, random);
  }

  if (event.type === "dragStart") {
    const resumeMode =
      state.mode === "paused" || state.resumeMode === "paused" ? "paused" : "walking";
    return {
      ...state,
      mode: "dragging",
      action: "idle",
      actionStartedMs: event.now,
      deadlineMs: null,
      resumeMode,
    };
  }

  if (event.type === "dragEnd" && state.mode === "dragging") {
    if (state.resumeMode === "paused") return pause(state, event.now);
    return {
      ...state,
      mode: "settling",
      action: "idle",
      actionStartedMs: event.now,
      deadlineMs: event.now + DRAG_SETTLE_MS,
      resumeMode: "walking",
    };
  }

  if (event.type === "edge" && state.mode === "walking") {
    const direction: Direction = state.direction === "left" ? "right" : "left";
    return {
      ...state,
      direction,
      action: walkingAction(direction),
      actionStartedMs: event.now,
    };
  }

  if (event.type === "click") {
    if (state.mode === "reacting" || state.mode === "dragging") return state;
    const action = randomItem(REACTION_ACTIONS, random);
    const resumeMode: ResumeMode = state.mode === "paused" ? "paused" : "walking";
    return {
      ...state,
      mode: "reacting",
      action,
      actionStartedMs: event.now,
      deadlineMs: event.now + animationDuration(ANIMATIONS[action]),
      resumeMode,
    };
  }

  if (event.type !== "tick" || state.deadlineMs === null || event.now < state.deadlineMs) {
    return state;
  }

  if (state.mode === "walking") {
    return {
      ...state,
      mode: "resting",
      action: randomItem(REST_ACTIONS, random),
      actionStartedMs: event.now,
      deadlineMs: event.now + randomBetween(REST_MIN_MS, REST_MAX_MS, random),
      resumeMode: "walking",
    };
  }

  if (state.mode === "resting" || state.mode === "settling") {
    return scheduleWalking(state, event.now, random);
  }

  if (state.mode === "reacting") {
    return state.resumeMode === "paused"
      ? pause(state, event.now)
      : scheduleWalking(state, event.now, random);
  }

  return state;
}

export function animationForState(state: PetState): AnimationDefinition {
  return ANIMATIONS[state.action];
}
