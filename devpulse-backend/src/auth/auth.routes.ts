import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../env.js";
import { authFlowRateLimiter } from "../middleware/rate-limit.js";
import { prisma } from "../prisma.js";
import { findOrCreateUserForGithubProfile } from "./auth.service.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubProfile,
  GithubOAuthError,
} from "./github-oauth.service.js";

export const authRouter = Router();

const CALLBACK_PATH = "/auth/github/callback";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: { message: "Not signed in" } });
    return;
  }
  next();
}

authRouter.get("/auth/github/login", authFlowRateLimiter, (req, res) => {
  const state = randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const redirectUri = `${env.API_BASE_URL}${CALLBACK_PATH}`;
  res.redirect(buildAuthorizeUrl(state, redirectUri));
});

authRouter.get(CALLBACK_PATH, async (req, res) => {
  const failureRedirect = `${env.WEB_BASE_URL}/login?error=oauth_failed`;

  const { code, state } = req.query;
  const expectedState = req.session.oauthState;
  req.session.oauthState = undefined;

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !expectedState ||
    state !== expectedState
  ) {
    res.redirect(failureRedirect);
    return;
  }

  try {
    const redirectUri = `${env.API_BASE_URL}${CALLBACK_PATH}`;
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const profile = await fetchGithubProfile(accessToken);
    const user = await findOrCreateUserForGithubProfile(profile);

    req.session.userId = user.id;
    res.redirect(env.WEB_BASE_URL);
  } catch (err) {
    if (err instanceof GithubOAuthError) {
      res.redirect(failureRedirect);
      return;
    }
    throw err;
  }
});

authRouter.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("devpulse.sid");
    res.status(204).end();
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: { message: "Not signed in" } });
    return;
  }

  res.json({
    id: user.id,
    githubLogin: user.githubLogin,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  });
});
