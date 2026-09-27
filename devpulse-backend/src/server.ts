import { app } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { startWebhookPoller } from "./pull-requests/webhook-poller.js";

const server = app.listen(env.PORT, () => {
  logger.info(`DevPulse API listening on http://localhost:${env.PORT}`);
});

const webhookPoller = startWebhookPoller();

async function shutdown() {
  clearInterval(webhookPoller);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
