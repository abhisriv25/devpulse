import { Router } from "express";
import { z } from "zod";
import { AlreadyInOrganizationError, createOrganizationForUser } from "../auth/auth.service.js";
import { requireAuth } from "../auth/auth.routes.js";
import { authFlowRateLimiter } from "../middleware/rate-limit.js";

export const organizationRouter = Router();

const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(60, "Organization name must be at most 60 characters"),
});

organizationRouter.post("/organizations", authFlowRateLimiter, requireAuth, async (req, res) => {
  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { message: parsed.error.issues[0].message } });
    return;
  }

  try {
    const organization = await createOrganizationForUser(req.session.userId as string, parsed.data.name);
    res.status(201).json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: "ADMIN",
    });
  } catch (err) {
    if (err instanceof AlreadyInOrganizationError) {
      res.status(409).json({ error: { message: err.message } });
      return;
    }
    throw err;
  }
});
