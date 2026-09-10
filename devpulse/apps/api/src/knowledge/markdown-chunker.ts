export interface MarkdownChunk {
  heading: string | null;
  content: string;
  /** A rough length-based estimate, not a real tokenizer count — see the
   * DocumentChunk.tokenCount doc comment in schema.prisma. */
  tokenCount: number;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const FENCE_PATTERN = /^```/;

interface Section {
  heading: string | null;
  lines: string[];
}

/** Splits raw content into heading-delimited sections, without ever
 * treating a line inside a fenced code block as a heading — a line like
 * `# comment` inside a ```bash block is code, not a section boundary. */
function splitIntoSections(content: string): Section[] {
  const sections: Section[] = [{ heading: null, lines: [] }];
  let insideFence = false;

  for (const line of content.split("\n")) {
    if (FENCE_PATTERN.test(line.trim())) {
      insideFence = !insideFence;
      sections[sections.length - 1].lines.push(line);
      continue;
    }

    const headingMatch = !insideFence ? HEADING_PATTERN.exec(line) : null;
    if (headingMatch) {
      sections.push({ heading: headingMatch[2].trim(), lines: [line] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  return sections;
}

/** Splits a section's lines into atomic blocks — a fenced code block is one
 * block no matter how long, everything else is split on blank lines. A
 * code block is never broken across chunks (see chunkMarkdown's doc
 * comment on why); a block of prose can be, at a paragraph boundary. */
function splitIntoBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let insideFence = false;

  const flush = () => {
    const text = current.join("\n").trim();
    if (text.length > 0) blocks.push(text);
    current = [];
  };

  for (const line of lines) {
    const isFenceLine = FENCE_PATTERN.test(line.trim());
    if (isFenceLine && !insideFence) {
      flush();
      insideFence = true;
      current.push(line);
      continue;
    }
    if (isFenceLine && insideFence) {
      current.push(line);
      insideFence = false;
      flush();
      continue;
    }
    if (insideFence) {
      current.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();

  return blocks;
}

function estimateTokenCount(text: string): number {
  // ~4 chars/token is a commonly-used rough estimate for English prose and
  // code; good enough to reason about chunk size, not a real tokenizer.
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Splits Markdown content into ordered chunks along heading boundaries,
 * then further splits any section longer than `maxChunkChars` at paragraph
 * boundaries — while never splitting a fenced code block across two
 * chunks, even if that means a single chunk exceeds `maxChunkChars`. A
 * broken-in-half code fence isn't a smaller chunk, it's two pieces of
 * invalid Markdown; staying under the size target loses to staying
 * syntactically intact.
 *
 * Pure function: no I/O, so this is exhaustively unit-testable without any
 * database or network mocking (see markdown-chunker.test.ts).
 */
export function chunkMarkdown(content: string, maxChunkChars = 1500): MarkdownChunk[] {
  if (content.trim().length === 0) return [];

  const sections = splitIntoSections(content);
  const chunks: MarkdownChunk[] = [];

  for (const section of sections) {
    const sectionText = section.lines.join("\n").trim();
    if (sectionText.length === 0) continue;

    if (sectionText.length <= maxChunkChars) {
      chunks.push({ heading: section.heading, content: sectionText, tokenCount: estimateTokenCount(sectionText) });
      continue;
    }

    // Section too big for one chunk — pack its blocks greedily, never
    // splitting a single block (a code fence or a paragraph) across chunks.
    const blocks = splitIntoBlocks(section.lines);
    let current: string[] = [];
    let currentLength = 0;

    const flushCurrent = () => {
      if (current.length === 0) return;
      const text = current.join("\n\n");
      chunks.push({ heading: section.heading, content: text, tokenCount: estimateTokenCount(text) });
      current = [];
      currentLength = 0;
    };

    for (const block of blocks) {
      if (currentLength > 0 && currentLength + block.length + 2 > maxChunkChars) {
        flushCurrent();
      }
      current.push(block);
      currentLength += block.length + 2;
    }
    flushCurrent();
  }

  return chunks;
}

/** The document's title, if it has a top-level heading — used to populate
 * Document.title on ingestion. Not part of chunkMarkdown itself since a
 * document's title and its chunks are read independently by the
 * ingestion pipeline. */
export function extractTitle(content: string): string | null {
  for (const line of content.split("\n")) {
    const match = /^#\s+(.*)$/.exec(line);
    if (match) return match[1].trim();
  }
  return null;
}
