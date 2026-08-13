import { describe, expect, it } from "vitest";

import { spriteStyle } from "./spriteStyle";

describe("spriteStyle", () => {
  it("crops one cell from the full atlas at normal display size", () => {
    expect(spriteStyle(2, 3, 1)).toEqual({
      width: "259.2px",
      height: "280.8px",
      backgroundImage: "url('/pets/zhizhi/spritesheet.webp')",
      backgroundRepeat: "no-repeat",
      backgroundSize: "2073.6px 3088.8px",
      backgroundPosition: "-518.4px -842.4px",
    });
  });

  it("scales the cell and offsets together for the small size", () => {
    expect(spriteStyle(1, 2, 0.8)).toMatchObject({
      width: "207.36px",
      height: "224.64px",
      backgroundPosition: "-207.36px -449.28px",
    });
  });
});
