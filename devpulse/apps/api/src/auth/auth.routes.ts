import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/client.js";
import { authFlowRateLimiter } from "../middleware/rate-limit.js";
import {
  buildGithubAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubProfile,
  generateOAuthState,
  upsertUserFromGithubProfile,
} from "./auth.service.js";

export const authRouter = Router();

/** Step 1: redirect the browser to GitHub, with a CSRF state token stashed
 * in the session so we can verify the callback actually came from a flow
 * we started. */
authRouter.get("/auth/github/login", authFlowRateLimiter, (req, res) => {
  const state = generateOAuthState();
  req.session.oauthState = state;
  res.redirect(buildGithubAuthorizeUrl(state));
});

/** Step 2: GitHub redirects back here with ?code=&state=. */
authRouter.get("/auth/github/callback", async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).json({ error: { code: "INVALID_CALLBACK", message: "Missing code or state" } });
  }

  if (!req.session.oauthState || state !== req.session.oauthState) {
    return res.status(400).json({ error: { code: "INVALID_STATE", message: "OAuth state mismatch" } });
  }
  // One-time use — clear it whether or not the rest of the flow succeeds.
  req.session.oauthState = undefined;

  try {
    const accessToken = await exchangeCodeForToken(code);
    const profile = await fetchGithubProfile(accessToken);
    const user = await upsertUserFromGithubProfile(profile);

    req.session.userId = user.id;
    res.redirect(env.WEB_BASE_URL);
  } catch (err) {
    req.log?.error({ err }, "GitHub OAuth callback failed");
    res.redirect(`${env.WEB_BASE_URL}/login?error=oauth_failed`);
  }
});

authRouter.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: { code: "LOGOUT_FAILED", message: "Could not destroy session" } });
    }
    res.clearCookie("devpulse.sid");
    res.status(204).send();
  });
});

/** The frontend's single source of truth for "am I logged in, and as who." */
authRouter.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not signed in" } });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: {
      memberships: { include: { organization: true } },
    },
  });

  if (!user) {
    // Session points at a user that no longer exists — treat as logged out
    // rather than erroring.
    req.session.destroy(() => {});
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not signed in" } });
  }

  res.json({
    id: user.id,
    githubLogin: user.githubLogin,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    organizations: user.memberships.map((m: (typeof user.memberships)[number]) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  });
});
