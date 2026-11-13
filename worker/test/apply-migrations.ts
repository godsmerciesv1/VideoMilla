import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Runs before every test file: the schema and seed rows are always present.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
