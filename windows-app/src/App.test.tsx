import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { NativeAdapter, TrayAction } from "./runtime/native";
import { DEFAULT_SETTINGS, type PetSettings } from "./settings/settings";

function createNative(overrides: Partial<NativeAdapter> = {}): {
  adapter: NativeAdapter;
  emitTray: (action: TrayAction) => void;
} {
  let trayHandler: ((action: TrayAction) => void) | undefined;
  const adapter: NativeAdapter = {
    loadSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS })),
    saveSettings: vi.fn(async () => undefined),
    moveStep: vi.fn(async () => ({ hitEdge: false, x: 0, y: 0, monitorName: null })),
    startDragging: vi.fn(async () => undefined),
    finishDragging: vi.fn(async () => ({
      hitEdge: false,
      x: 0,
      y: 0,
      monitorName: null,
    })),
    showContextMenu: vi.fn(async () => undefined),
    resizePet: vi.fn(async () => undefined),
    setAutostart: vi.fn(async (enabled) => enabled),
    resetPosition: vi.fn(async () => undefined),
    showAbout: vi.fn(async () => undefined),
    exitApp: vi.fn(async () => undefined),
    listenTray: vi.fn(async (handler) => {
      trayHandler = handler;
      return () => undefined;
    }),
    ...overrides,
  };

  return {
    adapter,
    emitTray: (action) => trayHandler?.(action),
  };
}

const frozenNow = () => 1_000;
const lowestRandom = () => 0;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Zhizhi desktop surface", () => {
  it("restores the persisted walking direction", async () => {
    const settings: PetSettings = { ...DEFAULT_SETTINGS, direction: "left" };
    const { adapter } = createNative({ loadSettings: vi.fn(async () => settings) });

    render(<App native={adapter} now={frozenNow} random={lowestRandom} />);

    expect(await screen.findByTestId("pet-sprite")).toHaveAttribute(
      "data-action",
      "walkLeft",
    );
  });

  it("plays one short reaction for a normal click", async () => {
    const { adapter } = createNative();
    render(<App native={adapter} now={frozenNow} random={lowestRandom} />);
    const sprite = await screen.findByTestId("pet-sprite");

    fireEvent.pointerDown(sprite, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(sprite, { button: 0, clientX: 21, clientY: 20, pointerId: 1 });

    expect(sprite).toHaveAttribute("data-action", "wave");
  });

  it("starts native dragging past the threshold instead of firing a click", async () => {
    const { adapter } = createNative();
    render(<App native={adapter} now={frozenNow} random={lowestRandom} />);
    const sprite = await screen.findByTestId("pet-sprite");

    fireEvent.pointerDown(sprite, { button: 0, clientX: 10, clientY: 10, pointerId: 2 });
    fireEvent.pointerMove(sprite, { button: 0, clientX: 30, clientY: 25, pointerId: 2 });

    await waitFor(() => expect(adapter.startDragging).toHaveBeenCalledOnce());
    expect(adapter.finishDragging).toHaveBeenCalledWith(false);
    expect(sprite).not.toHaveAttribute("data-action", "wave");
  });

  it("opens the native context menu and routes its actions through shared controls", async () => {
    const { adapter, emitTray } = createNative();
    render(<App native={adapter} now={frozenNow} random={lowestRandom} />);
    const sprite = await screen.findByTestId("pet-sprite");

    await waitFor(() => expect(adapter.listenTray).toHaveBeenCalledOnce());
    fireEvent.contextMenu(sprite, { clientX: 80, clientY: 90 });
    await waitFor(() => expect(adapter.showContextMenu).toHaveBeenCalledOnce());

    emitTray("toggle-pause");
    await waitFor(() => expect(adapter.saveSettings).toHaveBeenCalled());
    expect(sprite).toHaveAttribute("data-action", "idle");

    emitTray("size-small");
    expect(adapter.resizePet).toHaveBeenCalledWith(0.8, true);

    emitTray("toggle-autostart");
    expect(adapter.setAutostart).toHaveBeenCalledWith(true);
  });

  it("uses the same command path for tray actions", async () => {
    const { adapter, emitTray } = createNative();
    render(<App native={adapter} now={frozenNow} random={lowestRandom} />);
    const sprite = await screen.findByTestId("pet-sprite");

    await waitFor(() => expect(adapter.listenTray).toHaveBeenCalledOnce());
    emitTray("toggle-pause");
    await waitFor(() => expect(sprite).toHaveAttribute("data-action", "idle"));

    emitTray("size-large");
    await waitFor(() => expect(adapter.resizePet).toHaveBeenCalledWith(1.25, true));

    emitTray("about");
    emitTray("quit");
    await waitFor(() => {
      expect(adapter.showAbout).toHaveBeenCalledOnce();
      expect(adapter.exitApp).toHaveBeenCalledOnce();
    });
  });
});
