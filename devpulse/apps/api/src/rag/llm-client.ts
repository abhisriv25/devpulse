import { env } from "../config/env.js";

/** The response arrived (2xx) but didn't have the shape an OpenAI-compatible
 * chat completion is supposed to have — distinct from an HTTP failure,
 * since it means "something answered, but not usefully." */
export class LlmResponseError extends Error {}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

/**
 * Calls an OpenAI-compatible `/chat/completions` endpoint with a system +
 * user message pair and asks for a JSON-mode response. Returns the raw
 * response text — parsing and schema validation happen separately in
 * response-parser.ts, deliberately kept out of this function so the
 * "never trust model output blindly" logic is testable without mocking
 * an HTTP call, and this HTTP-calling logic is testable without needing
 * real schema-shaped fixtures.
 */
export async function generateChatCompletion(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${env.LLM_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      // Low but nonzero: this is an explanatory/summarization task grounded
      // in supplied facts, not creative writing — low temperature favors
      // consistency, but 0 can make some providers behave oddly for
      // structured-output requests.
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAiChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new LlmResponseError("LLM response missing message content");
  }

  return content;
}
