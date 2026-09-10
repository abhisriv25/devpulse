import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateChatCompletion, LlmResponseError } from "./llm-client.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("generateChatCompletion", () => {
  it("sends the model, system/user messages, and requests JSON-mode output", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "{}" } }] })
    );

    await generateChatCompletion("gpt-4o-mini", "system instructions", "user content");

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([
      { role: "system", content: "system instructions" },
      { role: "user", content: "user content" },
    ]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("returns the message content string", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: '{"summary":"ok"}' } }] })
    );

    const result = await generateChatCompletion("gpt-4o-mini", "s", "u");
    expect(result).toBe('{"summary":"ok"}');
  });

  it("throws LlmResponseError when the response has no message content", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({ choices: [{ message: {} }] }));
    await expect(generateChatCompletion("gpt-4o-mini", "s", "u")).rejects.toThrow(LlmResponseError);
  });

  it("throws LlmResponseError when the response has no choices at all", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}));
    await expect(generateChatCompletion("gpt-4o-mini", "s", "u")).rejects.toThrow(LlmResponseError);
  });

  it("throws a generic error on a non-2xx response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 429));
    await expect(generateChatCompletion("gpt-4o-mini", "s", "u")).rejects.toThrow(/429/);
  });
});
