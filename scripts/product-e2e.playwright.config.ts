import { defineConfig } from 'playwright/test';
import { resolve } from 'node:path';

const artifacts = resolve(process.env.PRODUCT_E2E_ARTIFACTS || '.agent-runs/product-e2e');

export default defineConfig({
  testDir: '.',
  testMatch: 'product-e2e.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['line'], ['json', { outputFile: `${artifacts}/results.json` }]],
  outputDir: `${artifacts}/browser`,
  use: {
    baseURL: process.env.PRODUCT_E2E_URL,
    browserName: 'chromium',
    screenshot: 'on',
    // Traces contain login credentials and authorization headers; do not upload them.
    trace: 'off',
  },
});
