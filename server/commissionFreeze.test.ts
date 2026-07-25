import { describe, expect, it } from "vitest";
import { digitalLevelToPercent } from "./db";

describe("digitalLevelToPercent", () => {
  it("maps level 1 to 30%, level 2 to 40%, level 3 to 50%", () => {
    expect(digitalLevelToPercent("1")).toBe(0.3);
    expect(digitalLevelToPercent("2")).toBe(0.4);
    expect(digitalLevelToPercent("3")).toBe(0.5);
  });
});
