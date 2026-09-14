import { randomBytes } from "node:crypto";
import { Router } from "express";
import { resolvePrimaryOrganizationId } from "../auth/auth.service.js";
import { requireAuth } from "../auth/auth.routes.js";
import { env } from "../env.js";
import { authFlowRateLimiter } from "../middleware/rate-limit.js";
import { prisma } from "../prisma.js";
import { GithubAppError } from "./github-app-auth.service.js";
import { syncInstallationRepositories } from "./repository.service.js";

export const githubRouter = Router();

const SETUP_PATH = "/github/setup";
const INSTALL_FAILED_REDIRECT = `${env.WEB_BASE_URL}/repositories?error=install_failed`;

githubRouter.get("/repositories", requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId as string);

  if (!organizationId) {
    res.json({ repositories: [] });
    return;
  }

  const repositories = await prisma.repository.findMany({
    where: { organizationId },
    orderBy: { connectedAt: "desc" },
  });

  res.json({
    repositories: repositories.map((repo) => ({
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      private: repo.private,
      connectedAt: repo.connectedAt.toISOString(),
    })),
  });
});

githubRouter.get("/github/install-url", authFlowRateLimiter, requireAuth, async (req, res) => {
  const organizationId = await resolvePrimaryOrganizationId(req.session.userId as string);

  if (!organizationId) {
    res.status(400).json({ error: { message: "No organization to install into" } });
    return;
  }

  const state = randomBytes(16).toString("hex");
  req.session.githubInstallState = state;
  req.session.githubInstallOrgId = organizationId;

  const url = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

githubRouter.get(SETUP_PATH, async (req, res) => {
  const { installation_id: installationId, state } = req.query;
  const expectedState = req.session.githubInstallState;
  const organizationId = req.session.githubInstallOrgId;
  req.session.githubInstallState = undefined;
  req.session.githubInstallOrgId = undefined;

  if (
    typeof installationId !== "string" ||
    typeof state !== "string" ||
    !expectedState ||
    !organizationId ||
    state !== expectedState
  ) {
    res.redirect(INSTALL_FAILED_REDIRECT);
    return;
  }

  try {
    await syncInstallationRepositories(organizationId, installationId);
    res.redirect(`${env.WEB_BASE_URL}/repositories`);
  } catch (err) {
    if (err instanceof GithubAppError) {
      res.redirect(INSTALL_FAILED_REDIRECT);
      return;
    }
    throw err;
  }
});
