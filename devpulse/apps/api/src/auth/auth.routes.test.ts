import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

// Mock the GitHub-facing calls so these tests exercise our own logic
// (state validation, session handling) without hitting the network.
vi.mock("./auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth.service.js")>();
  return {
    ...actual,
    exchangeCodeForToken: vi.fn().mockResolvedValue("fake-token"),
    fetchGithubProfile: vi.fn().mockResolvedValue({
      id: 12345,
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://example.com/avatar.png",
    }),
    upsertUserFromGithubProfile: vi.fn().mockResolvedValue({ id: "user_123" }),
  };
});

describe("GET /auth/github/callback", () => {
  it("rejects a callback with no matching session state (CSRF protection)", async () => {
    const app = buildApp();

    // No prior /auth/github/login call means no oauthState was ever
    // stashed in the session, so any state value here must be rejected.
    const res = await request(app).get("/auth/github/callback?code=abc&state=whatever-an-attacker-sends");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects a callback missing code or state entirely", async () => {
    const app = buildApp();
    const res = await request(app).get("/auth/github/callback");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_CALLBACK");
  });

  it("completes login when state matches what /auth/github/login issued", async () => {
    const app = buildApp();
    const agent = request.agent(app); // persists the session cookie across requests

    // Step 1: hit login, capture the redirect (which encodes ?state=...)
    const loginRes = await agent.get("/auth/github/login");
    expect(loginRes.status).toBe(302);
    const redirectUrl = new URL(loginRes.headers.location);
    const state = redirectUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    // Step 2: simulate GitHub's redirect back with the same state
    const callbackRes = await agent.get(`/auth/github/callback?code=abc123&state=${state}`);

    // Successful flow redirects to the web app, not a JSON error
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).not.toContain("error=oauth_failed");
  });
});

describe("GET /me", () => {
  it("returns 401 when there is no session", async () => {
    const app = buildApp();
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
