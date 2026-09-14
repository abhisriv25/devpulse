import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { authRouter } from "./auth/auth.routes.js";
import "./auth/session.types.js";
import { env, isProduction } from "./env.js";
import { githubRouter } from "./github/github.routes.js";
import { healthRouter } from "./health/health.routes.js";
import { logger } from "./logger.js";
import { webhookRouter } from "./webhooks/webhook.routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_BASE_URL, credentials: true }));
// Scoped to just this one path, and mounted *before* the global
// express.json() below — signature verification needs the exact bytes
// GitHub signed, and re-serializing parsed JSON isn't guaranteed to
// reproduce them byte-for-byte.
app.use("/webhooks/github", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers["x-request-id"]?.toString() ?? randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
  }),
);

// No Redis available in this environment, so sessions use express-session's
// default in-process MemoryStore — fine for a single local dev process, but
// sessions won't survive a server restart and this must not be used as-is
// in production (see connect-redis in package.json for the intended store).
app.use(
  session({
    name: "devpulse.sid",
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use(healthRouter);
app.use(authRouter);
app.use(githubRouter);
app.use(webhookRouter);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
});
