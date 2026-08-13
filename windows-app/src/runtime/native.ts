import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Direction } from "../pet/machine";
import type { PetSettings, SizeScale } from "../settings/settings";

export type TrayAction =
  | "toggle-pause"
  | "size-small"
  | "size-normal"
  | "size-large"
  | "toggle-autostart"
  | "reset"
  | "about"
  | "quit";

export interface MoveResult {
  hitEdge: boolean;
  x: number;
  y: number;
  monitorName: string | null;
}

export interface NativeAdapter {
  loadSettings(): Promise<PetSettings>;
  saveSettings(settings: PetSettings): Promise<void>;
  moveStep(direction: Direction, delta: number): Promise<MoveResult>;
  startDragging(): Promise<void>;
  finishDragging(paused: boolean): Promise<MoveResult>;
  showContextMenu(): Promise<void>;
  resizePet(sizeScale: SizeScale, paused: boolean): Promise<void>;
  setAutostart(enabled: boolean): Promise<boolean>;
  resetPosition(): Promise<void>;
  showAbout(): Promise<void>;
  exitApp(): Promise<void>;
  listenTray(handler: (action: TrayAction) => void): Promise<UnlistenFn>;
}

export const tauriNative: NativeAdapter = {
  loadSettings: () => invoke<PetSettings>("load_settings"),
  saveSettings: (settings) => invoke("save_settings", { settings }),
  moveStep: (direction, delta) =>
    invoke<MoveResult>("move_step", { direction, delta }),
  startDragging: () => invoke("start_pet_drag"),
  finishDragging: (paused) =>
    invoke<MoveResult>("finish_dragging", { paused }),
  showContextMenu: () => invoke("show_context_menu"),
  resizePet: (sizeScale, paused) => invoke("resize_pet", { sizeScale, paused }),
  setAutostart: (enabled) =>
    invoke<boolean>("set_autostart_enabled", { enabled }),
  resetPosition: () => invoke("reset_position"),
  showAbout: () => invoke("show_about"),
  exitApp: () => invoke("exit_app"),
  listenTray: async (handler) =>
    listen<TrayAction>("tray-action", (event) => handler(event.payload)),
};
