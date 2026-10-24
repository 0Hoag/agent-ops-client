import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'scripts/live-webhook.browser.spec.ts',
  reporter: 'line',
  outputDir: `${process.env.SMOKE_ARTIFACT_DIR || '.agent-runs/live-webhook'}/test-results`,
  use: { baseURL: process.env.SMOKE_CLIENT_URL || 'http://127.0.0.1:4174', browserName: 'chromium' },
});
