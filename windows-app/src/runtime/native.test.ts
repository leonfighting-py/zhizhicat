import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, windowStartDraggingMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  windowStartDraggingMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ startDragging: windowStartDraggingMock }),
}));

import { tauriNative } from "./native";

describe("tauriNative", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    windowStartDraggingMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    windowStartDraggingMock.mockResolvedValue(undefined);
  });

  it("keeps the drag lifecycle in Rust so Windows can wait for mouse release", async () => {
    await tauriNative.startDragging();

    expect(invokeMock).toHaveBeenCalledWith("start_pet_drag");
    expect(windowStartDraggingMock).not.toHaveBeenCalled();
  });
});
