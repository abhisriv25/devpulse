import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import RedisStore from "connect-redis";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { redis } from "./db/redis.js";
import { authRouter } from "./auth/auth.routes.js";
import { githubRouter } from "./github/github.routes.js";
import { pullRequestRouter } from "./pull-requests/pull-request.routes.js";
import { webhookRouter } from "./webhooks/webhook.routes.js";

export function buildApp() {
  const app = express();

  // Structured JSON logs, one line per request — matches DEPLOYMENT_OPS.md's
  // "no OpenTelemetry, just structured logs + a correlation id" choice.
  app.use(
    pinoHttp({
      genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID(),
    })
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_BASE_URL,
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Mounted before the global JSON body parser: the webhook route needs
  // the raw request bytes for signature verification (see webhook.routes.ts),
  // and letting express.json() consume the stream first would make that
  // impossible.
  app.use(webhookRouter);

  app.use(express.json());

  // Tests run without a live Redis instance, so fall back to express-session's
  // built-in MemoryStore in NODE_ENV=test only. Dev and prod always use Redis.
  const sessionStore =
    env.NODE_ENV === "test" ? undefined : new RedisStore({ client: redis, prefix: "devpulse:sess:" });

  app.use(
    session({
      store: sessionStore,
      name: "devpulse.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  app.get("/health", (_req, res) => {
    // Process is alive. Does not check dependencies — that's /ready.
    res.status(200).json({ status: "ok" });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await redis.ping();
      res.status(200).json({ status: "ready" });
    } catch (err) {
      res.status(503).json({ status: "not_ready", error: (err as Error).message });
    }
  });

  app.use(authRouter);
  app.use(githubRouter);
  app.use(pullRequestRouter);

  // Last-resort error handler: never leak stack traces, always log.
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log?.error({ err }, "Unhandled error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  return app;
}
