import { describe, it, expect } from "vitest";
import { selectModelForRiskLevel } from "./model-selector.js";

const MODELS = { small: "fixture-small", strong: "fixture-strong" };

describe("selectModelForRiskLevel", () => {
  it("returns null for LOW risk — no AI call at all", () => {
    expect(selectModelForRiskLevel("LOW", MODELS)).toBeNull();
  });

  it("returns the small model for MEDIUM risk", () => {
    expect(selectModelForRiskLevel("MEDIUM", MODELS)).toBe("fixture-small");
  });

  it("returns the strong model for HIGH risk", () => {
    expect(selectModelForRiskLevel("HIGH", MODELS)).toBe("fixture-strong");
  });

  it("returns the strong model for CRITICAL risk", () => {
    expect(selectModelForRiskLevel("CRITICAL", MODELS)).toBe("fixture-strong");
  });
});
