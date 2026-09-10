import { PrAnalysisResultSchema } from "./pr-analysis.types.js";
import type { PrAnalysisResult } from "./pr-analysis.types.js";

/** Covers both "the model didn't return valid JSON at all" and "it
 * returned JSON that doesn't match the required shape" — callers don't
 * need to distinguish the two, both mean the same thing: don't trust this
 * response. */
export class InvalidLlmResponseError extends Error {}

/**
 * The other half of "never trust model output blindly": every response is
 * parsed and schema-validated here before anything else in the codebase
 * touches it. A model that returns prose instead of JSON, omits a
 * required field, or invents a severity/confidence value outside the
 * enum throws immediately rather than silently propagating malformed
 * data into whatever calls this.
 */
export function parsePrAnalysisResponse(raw: string): PrAnalysisResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidLlmResponseError("LLM response was not valid JSON");
  }

  const result = PrAnalysisResultSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidLlmResponseError(`LLM response failed schema validation: ${result.error.message}`);
  }

  return result.data;
}
