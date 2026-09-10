import type { Request, Response, NextFunction } from "express";

/**
 * Gate for any route that needs a signed-in user. Deliberately does NOT
 * resolve organization/repo access here — that's a separate, resource-level
 * check (requireOrgAccess / requireRepoAccess) added in later slices, per
 * the two-step authorization pattern: authenticate, then authorize.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not signed in" } });
  }
  next();
}
