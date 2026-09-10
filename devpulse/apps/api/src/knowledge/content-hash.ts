import { createHash } from "node:crypto";

/** SHA-256 of a document's raw content — what makes re-ingestion cheap:
 * unchanged content means an unchanged hash means the ingestion pipeline
 * skips re-parsing/re-chunking it. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
