import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyGithubWebhookSignature } from "./webhook-signature.service.js";

// GITHUB_WEBHOOK_SECRET is set to "test-webhook-secret" in test/setup-env.ts.
const SECRET = "test-webhook-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(Buffer.from(body, "utf8")).digest("hex");
}

describe("verifyGithubWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = Buffer.from(JSON.stringify({ action: "opened" }), "utf8");
    expect(verifyGithubWebhookSignature(body, sign(body.toString("utf8")))).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = Buffer.from(JSON.stringify({ action: "opened" }), "utf8");
    const wrongSignature =
      "sha256=" + createHmac("sha256", "not-the-real-secret").update(body).digest("hex");
    expect(verifyGithubWebhookSignature(body, wrongSignature)).toBe(false);
  });

  it("rejects when the body was modified after signing", () => {
    const originalBody = JSON.stringify({ action: "opened" });
    const signature = sign(originalBody);
    const tamperedBody = Buffer.from(JSON.stringify({ action: "closed" }), "utf8");

    expect(verifyGithubWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = Buffer.from(JSON.stringify({ action: "opened" }), "utf8");
    expect(verifyGithubWebhookSignature(body, undefined)).toBe(false);
  });

  it("rejects a signature missing the sha256= prefix", () => {
    const body = Buffer.from(JSON.stringify({ action: "opened" }), "utf8");
    const raw = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyGithubWebhookSignature(body, raw)).toBe(false);
  });

  it("rejects garbage of a different length without throwing", () => {
    const body = Buffer.from(JSON.stringify({ action: "opened" }), "utf8");
    expect(() => verifyGithubWebhookSignature(body, "sha256=nope")).not.toThrow();
    expect(verifyGithubWebhookSignature(body, "sha256=nope")).toBe(false);
  });
});
