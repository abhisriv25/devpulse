import { describe, it, expect } from "vitest";
import { hashContent } from "./content-hash.js";

describe("hashContent", () => {
  it("produces the same hash for identical content", () => {
    expect(hashContent("hello world")).toBe(hashContent("hello world"));
  });

  it("produces a different hash for different content", () => {
    expect(hashContent("hello world")).not.toBe(hashContent("hello world!"));
  });

  it("is sensitive to whitespace-only differences", () => {
    expect(hashContent("hello world")).not.toBe(hashContent("hello world\n"));
  });

  it("returns a 64-character hex string (sha256)", () => {
    const hash = hashContent("anything");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
