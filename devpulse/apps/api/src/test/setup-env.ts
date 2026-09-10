process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://devpulse:devpulse@localhost:5432/devpulse_test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.GITHUB_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GITHUB_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GITHUB_APP_SLUG ??= "devpulse-test";
process.env.GITHUB_APP_ID ??= "123456";
// Never a real key — routes/services that would actually sign a JWT with
// this are mocked out in tests, this only needs to satisfy env validation.
process.env.GITHUB_APP_PRIVATE_KEY ??= "-----BEGIN RSA PRIVATE KEY-----\ntest-not-a-real-key\n-----END RSA PRIVATE KEY-----\n";
process.env.GITHUB_WEBHOOK_SECRET ??= "test-webhook-secret";
// Never a real key — the embedding provider itself is always mocked in
// tests, this only needs to satisfy env validation.
process.env.EMBEDDING_API_KEY ??= "test-embedding-api-key";
// Never a real key — the LLM client itself is always mocked in tests, this
// only needs to satisfy env validation.
process.env.LLM_API_KEY ??= "test-llm-api-key";
process.env.SESSION_SECRET ??= "test-session-secret-at-least-16-chars";
process.env.API_BASE_URL ??= "http://localhost:3000";
process.env.WEB_BASE_URL ??= "http://localhost:5173";
