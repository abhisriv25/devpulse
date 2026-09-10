import { randomBytes } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { authFlowRateLimiter } from "../middleware/rate-limit.js";
import { buildGithubAppInstallUrl, fetchInstallationRepositories } from "./github-app.service.js";
import {
  listRepositoriesForOrganization,
  resolvePrimaryOrganizationId,
  upsertRepositoriesFromInstallation,
  type RepositoryRecord,
} from "./repository.service.js";

export const githubRouter = Router();

/**
 * Step 1: redirect the browser to GitHub's "install this App" page.
 * Mirrors the OAuth login pattern in auth.routes.ts — a CSRF state token
 * stashed in the session — plus one addition: the organization this
 * install is *for* is also pinned in the session now, so the setup
 * callback resolves it server-side instead of trusting anything the
 * client sends back.
 */
githubRouter.get("/github/install-url", requireAuth, authFlowRateLimiter, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  if (!organizationId) {
    return res
      .status(400)
      .json({ error: { code: "NO_ORGANIZATION", message: "No organization found for this user" } });
  }

  const state = randomBytes(16).toString("hex");
  req.session.githubInstallState = state;
  req.session.githubInstallOrgId = organizationId;

  res.redirect(buildGithubAppInstallUrl(state));
});

/**
 * Step 2: GitHub redirects back here after install/update with
 * ?installation_id=&setup_action=&state=. This URL is configured as the
 * GitHub App's "Setup URL" (see .env.example for setup instructions).
 */
githubRouter.get("/github/setup", requireAuth, async (req, res) => {
  const { installation_id: installationId, state } = req.query;

  if (typeof installationId !== "string" || typeof state !== "string") {
    return res.redirect(`${env.WEB_BASE_URL}/repositories?error=invalid_callback`);
  }

  if (!req.session.githubInstallState || state !== req.session.githubInstallState) {
    return res.redirect(`${env.WEB_BASE_URL}/repositories?error=invalid_state`);
  }

  const organizationId = req.session.githubInstallOrgId;
  // One-time use — clear it whether or not the rest of the flow succeeds.
  req.session.githubInstallState = undefined;
  req.session.githubInstallOrgId = undefined;

  if (!organizationId) {
    return res.redirect(`${env.WEB_BASE_URL}/repositories?error=invalid_state`);
  }

  try {
    const repos = await fetchInstallationRepositories(installationId);
    await upsertRepositoriesFromInstallation(organizationId, installationId, repos);
    res.redirect(`${env.WEB_BASE_URL}/repositories?connected=1`);
  } catch (err) {
    req.log?.error({ err }, "GitHub App installation sync failed");
    res.redirect(`${env.WEB_BASE_URL}/repositories?error=install_failed`);
  }
});

/**
 * The repositories page's data source. Scoped to the caller's own
 * organization, resolved server-side from their session — never from a
 * client-supplied organizationId — which is what actually prevents Org A
 * from ever seeing Org B's connected repos.
 */
githubRouter.get("/repositories", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId!);
  if (!organizationId) {
    return res.json({ repositories: [] });
  }

  const repos = await listRepositoriesForOrganization(organizationId);
  res.json({
    repositories: repos.map((repo: RepositoryRecord) => ({
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      private: repo.private,
      connectedAt: repo.connectedAt,
    })),
  });
});
