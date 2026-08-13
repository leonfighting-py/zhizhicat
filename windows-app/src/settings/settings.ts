import type { Direction } from "../pet/machine";

export type SizeScale = 0.8 | 1 | 1.25;

export interface PetSettings {
  version: 1;
  x: number | null;
  y: number | null;
  monitorName: string | null;
  direction: Direction;
  paused: boolean;
  sizeScale: SizeScale;
  autostart: boolean;
}

export const DEFAULT_SETTINGS: PetSettings = {
  version: 1,
  x: null,
  y: null,
  monitorName: null,
  direction: "right",
  paused: false,
  sizeScale: 1,
  autostart: false,
};

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sizeScaleOrDefault(value: unknown): SizeScale {
  return value === 0.8 || value === 1 || value === 1.25 ? value : 1;
}

export function normalizeSettings(value: unknown): PetSettings {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_SETTINGS };
  const source = value as Record<string, unknown>;

  return {
    version: 1,
    x: finiteNumberOrNull(source.x),
    y: finiteNumberOrNull(source.y),
    monitorName: typeof source.monitorName === "string" ? source.monitorName : null,
    direction: source.direction === "left" ? "left" : "right",
    paused: source.paused === true,
    sizeScale: sizeScaleOrDefault(source.sizeScale),
    autostart: source.autostart === true,
  };
}

export function windowDimensions(sizeScale: SizeScale): {
  width: number;
  height: number;
} {
  return {
    width: Number((288 * sizeScale).toFixed(2)),
    height: Number((312 * sizeScale).toFixed(2)),
  };
}
