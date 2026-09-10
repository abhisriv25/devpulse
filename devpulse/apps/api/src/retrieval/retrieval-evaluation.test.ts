import { describe, it, expect } from "vitest";
import { scoreRetrieval, scoreRetrievalSuite } from "./retrieval-evaluation.js";

describe("scoreRetrieval", () => {
  it("scores 1.0 precision and recall for a perfect match", () => {
    const score = scoreRetrieval(["docs/a.md", "docs/b.md"], ["docs/a.md", "docs/b.md"]);
    expect(score).toEqual({ precision: 1, recall: 1 });
  });

  it("scores partial precision when some retrieved docs aren't relevant", () => {
    const score = scoreRetrieval(["docs/a.md"], ["docs/a.md", "docs/irrelevant.md"]);
    expect(score.precision).toBe(0.5);
    expect(score.recall).toBe(1);
  });

  it("scores partial recall when not every relevant doc was retrieved", () => {
    const score = scoreRetrieval(["docs/a.md", "docs/b.md"], ["docs/a.md"]);
    expect(score.precision).toBe(1);
    expect(score.recall).toBe(0.5);
  });

  it("scores 0/0 when nothing relevant was retrieved", () => {
    const score = scoreRetrieval(["docs/a.md"], ["docs/unrelated.md"]);
    expect(score).toEqual({ precision: 0, recall: 0 });
  });

  it("scores precision 0 (not NaN) when nothing was retrieved at all", () => {
    const score = scoreRetrieval(["docs/a.md"], []);
    expect(score.precision).toBe(0);
    expect(score.recall).toBe(0);
  });

  it("scores recall 1 (vacuously) when no documents were expected", () => {
    const score = scoreRetrieval([], ["docs/a.md"]);
    expect(score.recall).toBe(1);
  });
});

describe("scoreRetrievalSuite", () => {
  it("macro-averages precision/recall across cases", () => {
    const suite = scoreRetrievalSuite([
      { expectedPaths: ["a.md"], retrievedPaths: ["a.md"] }, // 1.0 / 1.0
      { expectedPaths: ["b.md"], retrievedPaths: ["c.md"] }, // 0.0 / 0.0
    ]);
    expect(suite.precision).toBe(0.5);
    expect(suite.recall).toBe(0.5);
  });

  it("returns zeroed scores for an empty suite rather than dividing by zero", () => {
    expect(scoreRetrievalSuite([])).toEqual({ precision: 0, recall: 0 });
  });
});
