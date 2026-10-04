import { env } from "../env.js";

const MAX_OUTPUT_TOKENS = 1200;

export class LlmNotConfiguredError extends Error {}
export class LlmResponseError extends Error {}

export async function generateChatCompletion(params: {
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  if (!env.LLM_API_KEY) throw new LlmNotConfiguredError("LLM_API_KEY is not set");

  const res = await fetch(`${env.LLM_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      // Cost guard: bounds output spend per analysis.
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed (status ${res.status})`);

  const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new LlmResponseError("LLM response had no message content");
  return content;
}
