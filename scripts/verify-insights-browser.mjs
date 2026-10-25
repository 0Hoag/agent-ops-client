import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const realUrl = process.env.INSIGHTS_BROWSER_URL;
const baseUrl = realUrl ?? 'http://127.0.0.1:4320';
const server = realUrl ? null : spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4320'], { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server?.stdout.on('data', (chunk) => { output += chunk.toString(); });
server?.stderr.on('data', (chunk) => { output += chunk.toString(); });
const errors = [];
const requests = [];
const evidence = 'artifacts/browser';
fs.mkdirSync(evidence, { recursive: true });
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`dev server exited: ${output}`);
    try { if ((await fetch(baseUrl)).status === 200) return; } catch {}
    await delay(500);
  }
  throw new Error(`dev server readiness timeout: ${output}`);
}
try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource: the server responded with a status of 503')) errors.push(message.text()); });
    if (realUrl) {
      const network = [];
      page.on('response', (response) => { if (response.url().includes('/api/v1/')) network.push({ url: response.url(), status: response.status() }); });
      await page.goto(`${baseUrl}/insights`);
      await page.getByRole('combobox', { name: 'Repository' }).selectOption({ label: 'fixture/insights' });
      await page.getByText(/History is incomplete/).waitFor();
      assert.deepEqual(await page.getByText('Unknown — incomplete history').count(), 3);
      await page.screenshot({ path: `${evidence}/insights-real-api.png`, fullPage: true });
      assert(network.some((item) => item.url.includes('/api/v1/insights?repository_id=') && item.status === 200), `real insights network response missing: ${JSON.stringify(network)}`);
      assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
      fs.writeFileSync(`${evidence}/insights-real-network.log`, `${JSON.stringify(network, null, 2)}\n`);
      console.log(`Insights real API/DOM PASS: selected fixture/insights, rendered unknown metrics; network=${JSON.stringify(network)}; screenshot=${evidence}/insights-real-api.png`);
    } else {
    let mode = 'loading';
    await page.route('**/api/v1/repositories**', async (route) => {
      requests.push(route.request().url());
      if (mode === 'loading') await delay(500);
      if (mode === 'repo-error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      const data = mode === 'empty' ? [] : [{ id: 'repo-1', provider: 'github', full_name: 'fixture/insights' }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, meta: { page: 1, per_page: 100, total: data.length } }) });
    });
    await page.route('**/api/v1/insights**', async (route) => {
      requests.push(route.request().url());
      if (mode === 'insights-loading') await delay(700);
      if (mode === 'insights-error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      const incomplete = mode === 'unknown';
      const response = { repository_id: 'repo-1', history: { complete: !incomplete, ...(incomplete ? { reason: 'fixture gap' } : {}) }, send_back: { count: 1, rate: 0.5, numerator: 1, denominator: 2, evidence: [] }, first_ci_success: { successful: 1, eligible: 2, rate: 0.5, evidence: [] }, cycle_time: { completed: 1, median_seconds: 86400, evidence: [] }, suggestions: [{ key: 'retry', message: 'Repeated workflow retry', occurrences: 2, evidence: [] }] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: response }) });
    });
    await page.goto('http://127.0.0.1:4320/insights');
    await page.getByRole('status').waitFor();
    await page.screenshot({ path: `${evidence}/insights-loading.png`, fullPage: true });
    await page.getByRole('combobox', { name: 'Repository' }).waitFor();
    mode = 'empty';
    await page.reload();
    await page.getByText('No repositories available.').waitFor();
    await page.screenshot({ path: `${evidence}/insights-empty.png`, fullPage: true });
    mode = 'repo-error';
    await page.reload();
    await page.getByRole('alert').waitFor();
    await page.screenshot({ path: `${evidence}/insights-error.png`, fullPage: true });
    mode = 'data';
    await page.reload();
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    await page.getByText('50.0%').first().waitFor();
    await page.getByText('Repeated workflow retry').waitFor();
    await page.screenshot({ path: `${evidence}/insights-data.png`, fullPage: true });
    mode = 'insights-loading';
    await page.reload();
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    await page.getByText('Loading insights…').waitFor();
    await page.screenshot({ path: `${evidence}/insights-metrics-loading.png`, fullPage: true });
    mode = 'insights-error';
    await page.reload();
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    await page.getByText(/Unable to load insights/).waitFor();
    await page.screenshot({ path: `${evidence}/insights-metrics-error.png`, fullPage: true });
    mode = 'unknown';
    await page.reload();
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    const unknownValues = page.getByText('Unknown — incomplete history');
    await unknownValues.first().waitFor();
    assert.equal(await unknownValues.count(), 3, 'all unknown metrics must remain unknown, not measured as zero');
    await page.getByText(/History is incomplete: fixture gap/).waitFor();
    await page.screenshot({ path: `${evidence}/insights-unknown.png`, fullPage: true });
    assert(requests.some((url) => url.includes('/api/v1/insights?repository_id=repo-1')), 'selected repository must scope insight request');
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    fs.writeFileSync(`${evidence}/insights-network.log`, `${requests.join('\n')}\n`);
    fs.writeFileSync(`${evidence}/insights-console.log`, 'No browser console/page errors.\n');
    console.log(`Insights browser PASS: loading, empty, repository error, data, metrics loading/error, unknown; requests=${requests.length}; console errors=0; evidence=${evidence}/`);
    }
  } finally { await browser.close(); }
} finally {
  if (server?.pid && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(5000)]);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
}
