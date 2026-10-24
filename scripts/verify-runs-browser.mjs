import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const url = process.env.RUNS_BROWSER_URL ?? 'http://127.0.0.1:4319';
const realData = process.env.RUNS_BROWSER_REAL_DATA === '1';
const server = process.env.RUNS_BROWSER_URL ? null : spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4319'], {
  cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server?.stdout.on('data', (chunk) => { output += chunk.toString(); });
server?.stderr.on('data', (chunk) => { output += chunk.toString(); });
const evidence = 'artifacts/browser';
fs.mkdirSync(evidence, { recursive: true });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`dev server exited: ${output}`);
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await delay(500);
  }
  throw new Error(`dev server readiness timeout: ${output}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (realData) {
      const expected = { wave: 'W3G', worker: 'wire', issue_number: 191, runs: 1, input_tokens: 100, cached_input_tokens: 20, cache_write_tokens: 30, output_tokens: 40, reasoning_tokens: 50, cost_usd: 0.00064 };
      const response = page.waitForResponse((item) => item.url().includes('/api/v1/agent-runs/aggregate'));
      await page.goto(`${url}/runs`);
      const aggregateResponse = await response;
      assert.equal(aggregateResponse.status(), 200, 'real aggregate endpoint response');
      const payload = await aggregateResponse.json();
      assert.deepEqual(payload.data, [expected], 'real aggregate API fixture');
      await page.getByRole('cell', { name: 'wire' }).waitFor();
      await page.getByRole('cell', { name: '$0.0006' }).waitFor();
      await page.screenshot({ path: `${evidence}/runs-real-data.png`, fullPage: true });
      console.log(`Real API /runs browser PASS; aggregate=${JSON.stringify(payload.data)}; screenshot=${evidence}/runs-real-data.png`);
    } else {
      let mode = 'loading';
      await page.route('**/api/v1/agent-runs/aggregate**', async (route) => {
        if (mode === 'loading') await delay(1000);
        if (mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mode === 'empty' ? [] : [{ wave: 'W3', worker: 'Browser fixture', issue_number: 31, runs: 2, input_tokens: 100, cached_input_tokens: 25, cache_write_tokens: 0, output_tokens: 5, reasoning_tokens: 0, cost_usd: 1.25 }] }) });
      });
      await page.goto(`${url}/runs`);
      await page.getByRole('status').waitFor();
      await page.screenshot({ path: `${evidence}/runs-loading.png`, fullPage: true });
      await page.getByText('Browser fixture').waitFor();
      mode = 'empty';
      await page.reload();
      await page.getByText('No runs recorded.').waitFor();
      await page.screenshot({ path: `${evidence}/runs-empty.png`, fullPage: true });
      mode = 'error';
      await page.reload();
      await page.getByRole('alert').waitFor();
      await page.screenshot({ path: `${evidence}/runs-error.png`, fullPage: true });
    }
    assert.deepEqual(errors, [], `browser page errors: ${errors.join('; ')}`);
    if (!realData) console.log(`Dedicated /runs browser fixtures PASS (loading, empty, error); screenshots: ${evidence}/`);
  } finally { await browser.close(); }
} finally {
  if (server?.pid && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(5000)]);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
}
