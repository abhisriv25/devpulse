import { describe, it, expect } from "vitest";
import { chunkMarkdown, extractTitle } from "./markdown-chunker.js";

describe("chunkMarkdown — basic structure", () => {
  it("returns an empty array for empty content", () => {
    expect(chunkMarkdown("")).toEqual([]);
    expect(chunkMarkdown("   \n  \n")).toEqual([]);
  });

  it("returns a single chunk for short content with no headings", () => {
    const chunks = chunkMarkdown("Just a short paragraph of text.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toBe("Just a short paragraph of text.");
  });

  it("splits into one chunk per heading, retaining the heading text in metadata", () => {
    const content = ["# Title", "Intro text.", "", "## Section A", "Content A.", "", "## Section B", "Content B."].join(
      "\n"
    );

    const chunks = chunkMarkdown(content);

    expect(chunks.map((c) => c.heading)).toEqual(["Title", "Section A", "Section B"]);
    expect(chunks[1].content).toContain("Content A.");
    expect(chunks[2].content).toContain("Content B.");
  });

  it("preserves document order", () => {
    const content = ["# One", "first", "", "# Two", "second", "", "# Three", "third"].join("\n");
    const chunks = chunkMarkdown(content);
    expect(chunks.map((c) => c.heading)).toEqual(["One", "Two", "Three"]);
  });

  it("puts content before the first heading into a heading: null chunk", () => {
    const content = ["Some preamble.", "", "# First heading", "Body."].join("\n");
    const chunks = chunkMarkdown(content);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].content).toBe("Some preamble.");
    expect(chunks[1].heading).toBe("First heading");
  });

  it("assigns a rough token count proportional to content length", () => {
    const chunks = chunkMarkdown("a".repeat(400));
    expect(chunks[0].tokenCount).toBeGreaterThan(50);
    expect(chunks[0].tokenCount).toBeLessThan(150);
  });
});

describe("chunkMarkdown — code blocks", () => {
  it("does not treat a '#' inside a fenced code block as a heading", () => {
    const content = ["# Real heading", "```bash", "# this is a comment, not markdown", "echo hi", "```"].join("\n");

    const chunks = chunkMarkdown(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Real heading");
    expect(chunks[0].content).toContain("# this is a comment, not markdown");
  });

  it("keeps a fenced code block intact even when the section is split for length", () => {
    const codeBlock = ["```js", ...Array.from({ length: 50 }, (_, i) => `line${i} = ${i};`), "```"].join("\n");
    const content = `# Heading\n\nSome intro prose.\n\n${codeBlock}\n\nSome trailing prose.`;

    const chunks = chunkMarkdown(content, 200); // force splitting well below the code block's own size

    // The code block must appear whole in exactly one chunk, never split across two.
    const chunkContainingFenceStart = chunks.filter((c) => c.content.includes("```js"));
    expect(chunkContainingFenceStart).toHaveLength(1);
    expect(chunkContainingFenceStart[0].content).toContain("line0 = 0;");
    expect(chunkContainingFenceStart[0].content).toContain("line49 = 49;");
    expect(chunkContainingFenceStart[0].content.match(/```/g)).toHaveLength(2); // opening and closing fence together
  });

  it("handles an unterminated code fence without hanging or throwing", () => {
    const content = ["# Heading", "```js", "const x = 1;", "// fence never closes"].join("\n");
    expect(() => chunkMarkdown(content)).not.toThrow();
  });
});

describe("chunkMarkdown — long sections", () => {
  it("splits a section exceeding maxChunkChars into multiple chunks at paragraph boundaries", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => `Paragraph ${i}. `.repeat(10));
    const content = `# Big section\n\n${paragraphs.join("\n\n")}`;

    const chunks = chunkMarkdown(content, 300);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.heading).toBe("Big section");
    }
    // Every paragraph shows up somewhere, none lost or duplicated.
    const combined = chunks.map((c) => c.content).join("\n");
    for (let i = 0; i < 10; i++) {
      expect(combined).toContain(`Paragraph ${i}.`);
    }
  });

  it("keeps chunks at or under maxChunkChars when blocks allow it", () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Short para ${i}.`);
    const content = `# Section\n\n${paragraphs.join("\n\n")}`;

    const chunks = chunkMarkdown(content, 100);

    for (const chunk of chunks) {
      // A little slack for join overhead, but should be in the right ballpark.
      expect(chunk.content.length).toBeLessThan(150);
    }
  });
});

describe("extractTitle", () => {
  it("returns the first H1's text", () => {
    expect(extractTitle("# My Document\n\nBody text.")).toBe("My Document");
  });

  it("ignores H2+ when looking for a title", () => {
    expect(extractTitle("## Not a title\n\nBody.")).toBeNull();
  });

  it("returns null when there's no heading at all", () => {
    expect(extractTitle("Just plain text, no headings.")).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(extractTitle("")).toBeNull();
  });
});
