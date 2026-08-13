import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  windowDimensions,
} from "./settings";

describe("settings normalization", () => {
  it("uses safe local-only defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      version: 1,
      x: null,
      y: null,
      monitorName: null,
      direction: "right",
      paused: false,
      sizeScale: 1,
      autostart: false,
    });
  });

  it("accepts only the three confirmed size choices", () => {
    expect(normalizeSettings({ sizeScale: 0.8 }).sizeScale).toBe(0.8);
    expect(normalizeSettings({ sizeScale: 1 }).sizeScale).toBe(1);
    expect(normalizeSettings({ sizeScale: 1.25 }).sizeScale).toBe(1.25);
    expect(normalizeSettings({ sizeScale: 1.1 }).sizeScale).toBe(1);
  });

  it("recovers from invalid stored fields without discarding valid ones", () => {
    expect(
      normalizeSettings({
        version: 999,
        x: Number.NaN,
        y: -320,
        monitorName: 42,
        direction: "up",
        paused: true,
        autostart: "yes",
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      y: -320,
      paused: true,
    });
  });

  it("scales the 288 × 312 logical window as one unit", () => {
    expect(windowDimensions(0.8)).toEqual({ width: 230.4, height: 249.6 });
    expect(windowDimensions(1)).toEqual({ width: 288, height: 312 });
    expect(windowDimensions(1.25)).toEqual({ width: 360, height: 390 });
  });
});
