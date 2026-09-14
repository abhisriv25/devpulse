import { Router } from "express";
import { prisma } from "../prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Session storage in this environment is the in-process MemoryStore (no
// Redis available locally — see server.ts), so the one real external
// dependency worth checking here is the database.
healthRouter.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
