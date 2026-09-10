import pino from "pino";
import { env } from "./config/env.js";

/**
 * pino-http (see app.ts) gives every HTTP request its own child logger via
 * req.log. Background work — the Slice 4 webhook poller, and anything
 * later that isn't triggered by a request — has no req to hang a logger
 * off of, so it gets this top-level instance instead. Same structured
 * JSON-lines output either way.
 */
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
});
