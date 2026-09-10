import { z } from "zod";

// Fail fast and loud if required env vars are missing, rather than
// discovering it later as a confusing runtime error deep in a request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  GITHUB_OAUTH_CLIENT_ID: z.string().min(1, "GITHUB_OAUTH_CLIENT_ID is required"),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1, "GITHUB_OAUTH_CLIENT_SECRET is required"),

  // --- GitHub App (Slice 2: repository connection) — separate from the
  // OAuth App above. Used to build the install link and to mint short-lived
  // installation access tokens, never to identify a human user.
  GITHUB_APP_SLUG: z.string().min(1, "GITHUB_APP_SLUG is required"),
  GITHUB_APP_ID: z.string().min(1, "GITHUB_APP_ID is required"),
  // Stored as a single-line env var with literal \n sequences (the common
  // convention for PEM values in .env files); normalized to real newlines
  // here so callers can hand it straight to a JWT library.
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1, "GITHUB_APP_PRIVATE_KEY is required")
    .transform((val) => val.replace(/\\n/g, "\n")),
  // Slice 3: the secret configured on the GitHub App's Webhook tab, used to
  // verify X-Hub-Signature-256 on every incoming delivery.
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GITHUB_WEBHOOK_SECRET is required"),

  // --- Embeddings (Slice 8) — an OpenAI-compatible /embeddings endpoint.
  // EMBEDDING_API_BASE_URL is overridable so a compatible provider (Azure
  // OpenAI, a local model server, etc.) can be swapped in without a code
  // change.
  EMBEDDING_API_KEY: z.string().min(1, "EMBEDDING_API_KEY is required"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  EMBEDDING_API_BASE_URL: z.string().url().default("https://api.openai.com/v1"),

  // --- LLM (Slice 9) — an OpenAI-compatible /chat/completions endpoint.
  // Two model tiers, not one: LLM_MODEL_SMALL for MEDIUM-risk PRs,
  // LLM_MODEL_STRONG for HIGH/CRITICAL — LOW-risk PRs get no AI call at
  // all (see rag/model-selector.ts). A real cost control, not a default.
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_API_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL_SMALL: z.string().min(1).default("gpt-4o-mini"),
  LLM_MODEL_STRONG: z.string().min(1).default("gpt-4o"),

  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),

  API_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
