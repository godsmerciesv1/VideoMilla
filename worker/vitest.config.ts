import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        // Tests run fully offline: no remote AI binding, no Cloudflare login.
        remoteBindings: false,
        miniflare: {
          // Secrets exist only for tests: fixed, fake values.
          bindings: {
            TEST_MIGRATIONS: migrations,
            PEPPER: 'test-pepper',
            GOOGLE_SA_JSON: '{}',
            GEMINI_API_KEY: 'test',
            SEGMIND_API_KEY: 'test',
            PRUNA_API_KEY: 'test',
            POLAR_ACCESS_TOKEN: 'test',
            POLAR_WEBHOOK_SECRET: 'test',
            BREVO_API_KEY: 'test',
            GOOGLE_OAUTH_CLIENT_IDS: 'test',
          },
        },
      }),
    ],
    test: { setupFiles: ['./test/apply-migrations.ts'] },
  };
});
