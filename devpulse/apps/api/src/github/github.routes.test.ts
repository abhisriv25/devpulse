import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

// Mock every GitHub-facing / DB-facing call so these tests exercise our own
// routing and authorization logic (state validation, session handling,
// org scoping) without a real Postgres or network dependency — same
// pattern as auth.routes.test.ts.
vi.mock("./github-app.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github-app.service.js")>();
  return {
    ...actual,
    fetchInstallationRepositories: vi.fn(),
  };
});

vi.mock("./repository.service.js", () => ({
  resolvePrimaryOrganizationId: vi.fn(),
  upsertRepositoriesFromInstallation: vi.fn(),
  listRepositoriesForOrganization: vi.fn(),
}));

// Same approach as auth.routes.test.ts: mock the network-facing calls so
// logging an agent in exercises real session/state logic without hitting
// GitHub.
vi.mock("../auth/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/auth.service.js")>();
  return {
    ...actual,
    exchangeCodeForToken: vi.fn().mockResolvedValue("fake-token"),
    fetchGithubProfile: vi.fn().mockResolvedValue({
      id: 999,
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://example.com/a.png",
    }),
    upsertUserFromGithubProfile: vi.fn().mockResolvedValue({ id: "user_123" }),
  };
});

import { fetchInstallationRepositories } from "./github-app.service.js";
import {
  listRepositoriesForOrganization,
  resolvePrimaryOrganizationId,
  upsertRepositoriesFromInstallation,
} from "./repository.service.js";

const mockedResolveOrg = vi.mocked(resolvePrimaryOrganizationId);
const mockedFetchRepos = vi.mocked(fetchInstallationRepositories);
const mockedUpsertRepos = vi.mocked(upsertRepositoriesFromInstallation);
const mockedListRepos = vi.mocked(listRepositoriesForOrganization);

/** Logs an agent in by driving the real OAuth callback (mocked network
 * calls), so every test starts from a genuine authenticated session
 * instead of poking session internals directly. */
async function loginAgent(agent: ReturnType<typeof request.agent>) {
  const loginRes = await agent.get("/auth/github/login");
  const state = new URL(loginRes.headers.location).searchParams.get("state");
  await agent.get(`/auth/github/callback?code=abc&state=${state}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /repositories", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/repositories");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("scopes results to the caller's own organization, resolved server-side", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);

    mockedResolveOrg.mockResolvedValue("org_mine");
    mockedListRepos.mockResolvedValue([
      {
        id: "repo_1",
        organizationId: "org_mine",
        githubInstallationId: "inst_1",
        githubRepoId: "555",
        owner: "acme",
        name: "widgets",
        fullName: "acme/widgets",
        private: true,
        connectedAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);

    // Even if a caller tries to smuggle in a different org via query
    // params, the route never reads one — resolvePrimaryOrganizationId is
    // the only source of the org id, and it's derived from the session.
    const res = await agent.get("/repositories?organizationId=org_someone_elses");

    expect(res.status).toBe(200);
    expect(res.body.repositories).toHaveLength(1);
    expect(res.body.repositories[0].fullName).toBe("acme/widgets");
    // The org actually queried came from the session-derived resolver,
    // not from the query string.
    expect(mockedListRepos).toHaveBeenCalledWith("org_mine");
  });

  it("returns an empty list when the user has no organization", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);

    mockedResolveOrg.mockResolvedValue(null);

    const res = await agent.get("/repositories");
    expect(res.status).toBe(200);
    expect(res.body.repositories).toEqual([]);
    expect(mockedListRepos).not.toHaveBeenCalled();
  });
});

describe("GET /github/install-url", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/github/install-url");
    expect(res.status).toBe(401);
  });

  it("redirects to the GitHub App install page with a state param, and stashes org + state in session", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);

    mockedResolveOrg.mockResolvedValue("org_mine");

    const res = await agent.get("/github/install-url");

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.hostname).toBe("github.com");
    expect(location.pathname).toContain("/installations/new");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("rejects when the user has no organization", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);

    mockedResolveOrg.mockResolvedValue(null);

    const res = await agent.get("/github/install-url");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NO_ORGANIZATION");
  });
});

describe("GET /github/setup", () => {
  it("redirects with an error when installation_id or state is missing", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);

    const res = await agent.get("/github/setup");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=invalid_callback");
  });

  it("rejects a callback whose state doesn't match what install-url issued (CSRF protection)", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");
    await agent.get("/github/install-url"); // issues real state into session

    const res = await agent.get("/github/setup?installation_id=42&state=attacker-supplied");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=invalid_state");
    expect(mockedFetchRepos).not.toHaveBeenCalled();
  });

  it("completes the flow: fetches installation repos and upserts them under the pinned org", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");

    const installRes = await agent.get("/github/install-url");
    const state = new URL(installRes.headers.location).searchParams.get("state");

    mockedFetchRepos.mockResolvedValue([
      { id: 555, name: "widgets", full_name: "acme/widgets", private: true, owner: { login: "acme" } },
    ]);

    const res = await agent.get(`/github/setup?installation_id=42&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/repositories?connected=1");
    expect(mockedFetchRepos).toHaveBeenCalledWith("42");
    expect(mockedUpsertRepos).toHaveBeenCalledWith(
      "org_mine",
      "42",
      expect.arrayContaining([expect.objectContaining({ full_name: "acme/widgets" })])
    );
  });

  it("is single-use: replaying the same state twice fails the second time", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");

    const installRes = await agent.get("/github/install-url");
    const state = new URL(installRes.headers.location).searchParams.get("state");
    mockedFetchRepos.mockResolvedValue([]);

    const first = await agent.get(`/github/setup?installation_id=42&state=${state}`);
    expect(first.headers.location).toContain("connected=1");

    const second = await agent.get(`/github/setup?installation_id=42&state=${state}`);
    expect(second.headers.location).toContain("error=invalid_state");
  });

  it("degrades gracefully when the GitHub API call fails", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAgent(agent);
    mockedResolveOrg.mockResolvedValue("org_mine");

    const installRes = await agent.get("/github/install-url");
    const state = new URL(installRes.headers.location).searchParams.get("state");
    mockedFetchRepos.mockRejectedValue(new Error("GitHub API 500"));

    const res = await agent.get(`/github/setup?installation_id=42&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=install_failed");
  });
});
