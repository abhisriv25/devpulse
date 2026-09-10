import { describe, it, expect } from "vitest";
import { parsePrAnalysisResponse, InvalidLlmResponseError } from "./response-parser.js";

const VALID_RESPONSE = {
  summary: "This PR increases caching risk.",
  riskExplanation: [
    { title: "Large diff", severity: "HIGH", reason: "Touches many files", evidence: ["src/cache.ts"] },
  ],
  recommendations: [
    { action: "Add invalidation tests", reason: "No tests changed", source: "docs/caching.md" },
  ],
  confidence: "MEDIUM",
};

describe("parsePrAnalysisResponse", () => {
  it("parses and returns a valid, schema-matching response", () => {
    const result = parsePrAnalysisResponse(JSON.stringify(VALID_RESPONSE));
    expect(result).toEqual(VALID_RESPONSE);
  });

  it("accepts a null source (a recommendation not grounded in a specific document)", () => {
    const withNullSource = { ...VALID_RESPONSE, recommendations: [{ ...VALID_RESPONSE.recommendations[0], source: null }] };
    const result = parsePrAnalysisResponse(JSON.stringify(withNullSource));
    expect(result.recommendations[0].source).toBeNull();
  });

  it("throws InvalidLlmResponseError when the response isn't valid JSON", () => {
    expect(() => parsePrAnalysisResponse("not json at all")).toThrow(InvalidLlmResponseError);
  });

  it("throws InvalidLlmResponseError when a required field is missing", () => {
    const { summary: _summary, ...missingSummary } = VALID_RESPONSE;
    expect(() => parsePrAnalysisResponse(JSON.stringify(missingSummary))).toThrow(InvalidLlmResponseError);
  });

  it("throws InvalidLlmResponseError when confidence is outside the allowed enum", () => {
    const invalid = { ...VALID_RESPONSE, confidence: "VERY_HIGH" };
    expect(() => parsePrAnalysisResponse(JSON.stringify(invalid))).toThrow(InvalidLlmResponseError);
  });

  it("throws InvalidLlmResponseError when a risk severity is outside the allowed enum", () => {
    const invalid = {
      ...VALID_RESPONSE,
      riskExplanation: [{ ...VALID_RESPONSE.riskExplanation[0], severity: "EXTREME" }],
    };
    expect(() => parsePrAnalysisResponse(JSON.stringify(invalid))).toThrow(InvalidLlmResponseError);
  });

  it("throws InvalidLlmResponseError when the response is prose instead of JSON", () => {
    expect(() =>
      parsePrAnalysisResponse("Sure! Here's my analysis: this PR looks risky because...")
    ).toThrow(InvalidLlmResponseError);
  });

  it("accepts empty arrays for riskExplanation and recommendations", () => {
    const minimal = { summary: "Nothing notable.", riskExplanation: [], recommendations: [], confidence: "LOW" };
    const result = parsePrAnalysisResponse(JSON.stringify(minimal));
    expect(result.riskExplanation).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});
