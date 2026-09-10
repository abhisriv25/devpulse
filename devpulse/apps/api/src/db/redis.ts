import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  // Fail fast rather than hanging silently if Redis is unreachable at boot -
  // makes local dev misconfiguration obvious immediately instead of a vague
  // timeout minutes later.
  maxRetriesPerRequest: 3,
  // Don't open a connection just from importing this module — only connect
  // when a command is actually issued. Keeps test runs (which import app.ts
  // but never touch Redis) fast and log-free.
  lazyConnect: true,
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});
