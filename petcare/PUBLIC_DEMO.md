# Public demo

The existing Site now opens without ChatGPT sign-in. Public access must be enabled in Sites after deploying this version.

Every browser receives an independent 256-bit random, HTTP-only, same-site cookie. Only the SHA-256-derived demo owner key is stored with records. Existing ChatGPT-owned records are not exposed or migrated into demo sessions. Platform identity headers and legacy local test-login cookies are ignored by the demo API.

POST /api/demo initializes two sample pets and three schedules atomically and idempotently. Clearing cookies starts a new demo; the previous data is not automatically deleted. Data is stored in D1/R2, not synced across different browser sessions. Cookie retention is 30 days. No account recovery is provided.

The 10-second notification is a short demonstration requiring the browser to remain running. No permanent background scheduling service has been connected.

Tests: node --test tests/demo-session.test.mjs tests/notification-demo.test.mjs tests/languages.test.mjs tests/recurrence.test.mjs. Run tests/demo-integration.mjs against a local server (PUBLIC_DEMO_TEST_URL may set the local port).
