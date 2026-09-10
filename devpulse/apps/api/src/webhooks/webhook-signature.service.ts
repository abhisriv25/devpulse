import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies GitHub's `X-Hub-Signature-256` header against the raw request
 * body. Deliberately takes the raw bytes, not a parsed object — HMAC is
 * computed over the exact bytes GitHub sent, and re-serializing a parsed
 * JSON object is not guaranteed to reproduce them byte-for-byte (key
 * order, whitespace, number formatting can all differ). Parse JSON only
 * after this returns true.
 *
 * Uses a timing-safe comparison so response time can't leak how many
 * leading bytes of the signature matched.
 */
export function verifyGithubWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const expected = SIGNATURE_PREFIX + createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");

  // timingSafeEqual throws if lengths differ, which happens routinely for
  // garbage/short signature headers — that's just "not a match", not an
  // error worth propagating.
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
