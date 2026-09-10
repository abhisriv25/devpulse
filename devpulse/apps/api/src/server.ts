import "dotenv/config";
import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { startWebhookEventPoller } from "./pull-requests/webhook-poller.js";

const app = buildApp();

app.listen(env.PORT, () => {
  console.log(`DevPulse API listening on http://localhost:${env.PORT}`);
});

// Slice 4: pick up RECEIVED webhook events and sync PR state. See
// webhook-poller.ts for why this lives here and not in app.ts.
startWebhookEventPoller();
