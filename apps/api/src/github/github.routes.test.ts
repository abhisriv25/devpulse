import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: { upsert: vi.fn() },
  organization: { create: vi.fn() },
  membership: { create: vi.fn(), findFirst: vi.fn() },
  repository: { findMany: vi.fn(), upsert: vi.fn() },
};

vi.mock("../prisma.js", () => ({ prisma: prismaMock }));

const { app } = await import("../app.js");

const GITHUB_USER = { id: 42, login: "octocat", name: null, avatar_url: null };

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Promise<Response>;
}

/** Logs an agent in via a mocked OAuth round-trip and returns it, with the
 * user already resolved to organizationId "org-1" for subsequent calls. */
async function loginAgent() {
  prismaMock.user.upsert.mockResolvedValueOnce({
    id: "user-1",
    githubLogin: "octocat",
    displayName: null,
    avatarUrl: null,
    memberships: [{ id: "membership-1", organizationId: "org-1", role: "ADMIN" }],
  });

  const agent = request.agent(app);
  const loginRes = await agent.get("/auth/github/login");
  const state = new URL(loginRes.headers.location).searchParams.get("state");

  const fetchMock = vi.fn((url: string) => {
    if (url.includes("/login/oauth/access_token")) {
      return jsonResponse({ access_token: "oauth-token" });
    }
    if (url === "https://api.github.com/user") {
      return jsonResponse(GITHUB_USER);
    }
    throw new Error(`Unexpected fetch during login: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  await agent.get(`/auth/github/callback?code=abc&state=${state}`);
  vi.unstubAllGlobals();

  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue({ organizationId: "org-1" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /repositories", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/repositories");
    expect(res.status).toBe(401);
  });

  it("returns an empty list gracefully when the user has no organization", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    const agent = await loginAgent();

    const res = await agent.get("/repositories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ repositories: [] });
  });

  it("is scoped to the caller's own organization, ignoring a spoofed query param", async () => {
    const agent = await loginAgent();
    prismaMock.repository.findMany.mockResolvedValueOnce([
      {
        id: "repo-1",
        owner: "octocat",
        name: "hello-world",
        fullName: "octocat/hello-world",
        private: false,
        connectedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);

    const res = await agent.get("/repositories?organizationId=some-other-org");

    expect(res.status).toBe(200);
    expect(prismaMock.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" } }),
    );
    expect(res.body.repositories).toEqual([
      {
        id: "repo-1",
        owner: "octocat",
        name: "hello-world",
        fullName: "octocat/hello-world",
        private: false,
        connectedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("GET /github/install-url", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/github/install-url");
    expect(res.status).toBe(401);
  });

  it("rejects when the user has no organization", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    const agent = await loginAgent();

    const res = await agent.get("/github/install-url");

    expect(res.status).toBe(400);
  });

  it("redirects to GitHub's install page with a fresh state token", async () => {
    const agent = await loginAgent();

    const res = await agent.get("/github/install-url");

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(
      "https://github.com/apps/test-app/installations/new",
    );
    expect(location.searchParams.get("state")).toBeTruthy();
  });
});

describe("GET /github/setup", () => {
  it("rejects a request missing installation_id/state", async () => {
    const res = await request(app).get("/github/setup");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/repositories?error=install_failed");
  });

  it("rejects a mismatched or replayed state (CSRF protection)", async () => {
    const agent = await loginAgent();
    await agent.get("/github/install-url");

    const res = await agent.get("/github/setup?installation_id=99&state=not-the-real-state");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/repositories?error=install_failed");
  });

  it("completes the install flow end-to-end", async () => {
    const agent = await loginAgent();
    const installRes = await agent.get("/github/install-url");
    const state = new URL(installRes.headers.location).searchParams.get("state");

    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/access_tokens")) {
        return jsonResponse({ token: "installation-token" });
      }
      if (url.includes("/installation/repositories")) {
        return jsonResponse({
          repositories: [
            { id: 1, name: "hello-world", full_name: "octocat/hello-world", private: false, owner: { login: "octocat" } },
          ],
        });
      }
      throw new Error(`Unexpected fetch during setup: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await agent.get(`/github/setup?installation_id=99&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/repositories");
    expect(prismaMock.repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_githubRepoId: { organizationId: "org-1", githubRepoId: "1" } },
        create: expect.objectContaining({ organizationId: "org-1", githubRepoId: "1" }),
      }),
    );
  });

  it("degrades to a clear error redirect if the GitHub API call fails", async () => {
    const agent = await loginAgent();
    const installRes = await agent.get("/github/install-url");
    const state = new URL(installRes.headers.location).searchParams.get("state");

    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({}, false, 500)),
    );

    const res = await agent.get(`/github/setup?installation_id=99&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/repositories?error=install_failed");
  });
});
