import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const url = process.env.RUNS_BROWSER_URL ?? 'http://127.0.0.1:4319';
const evidence = process.env.RUNS_EVIDENCE_DIR ?? '/Users/zeross/agent-ops-client/.agent-runs/W11b';
const server = process.env.RUNS_BROWSER_URL ? null : spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4319'], { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server?.stdout.on('data', (chunk) => { output += chunk.toString(); });
server?.stderr.on('data', (chunk) => { output += chunk.toString(); });
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
    const requests = [];
    const timelineRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'browser-fixture-token'));
    await page.route('**/api/v1/auth/session**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"organization_id":"fixture"}' }));
    let mode = 'loading';
    await page.route('**/api/v1/agent-runs**', async (route) => {
      const target = new URL(route.request().url());
      if (target.pathname.endsWith('/aggregate')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
      if (target.pathname.endsWith('/timeline')) {
        timelineRequests.push(target.pathname);
        const steps = Array.from({ length: 50 }, (_, index) => ({ id: `step-${index + 1}`, sequence: index + 1, input_tokens: 100, cached_input_tokens: 10, cache_write_tokens: 5, output_tokens: 20, reasoning_tokens: 3, tool_name: index % 2 ? 'search' : 'test', cache_hit: index % 3 === 0, cumulative_cost_usd: (index + 1) * 0.0001 }));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { steps } }) });
      }
      requests.push({ path: target.pathname, query: Object.fromEntries(target.searchParams) });
      if (mode === 'loading') await delay(1000);
      if (mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      const rows = mode === 'empty' ? [] : [{ id: 'fixture-run-1', wave: 'W11', harness: 'Browser fixture', model: 'fixture-model', issue_numbers: [31], pr_number: 32, started_at: new Date().toISOString(), relations: { issues: [{ number: 31, repository_id: 'owner/repo', title: 'fixture issue' }], pull_requests: [{ number: 32, repository_id: 'owner/repo', title: 'fixture PR' }], ci: [{ status: 'success', conclusion: 'passed' }] } }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows, meta: { page: 1, per_page: 20, total: mode === 'large' ? 10000 : rows.length } }) });
    });

    await page.goto(`${url}/runs`);
    await page.getByText('Browser fixture').waitFor();
    const started = performance.now();
    await page.getByText('Browser fixture').waitFor();
    await page.getByRole('link', { name: '#31 fixture issue' }).waitFor();
    await page.getByRole('link', { name: '#32 fixture PR' }).waitFor();
    const initialRenderMs = Math.round(performance.now() - started);
    await page.screenshot({ path: `${evidence}/runs-data.png`, fullPage: true });

    mode = 'loading';
    await page.goto(`${url}/runs`);
    await page.getByText('Loading runs…').waitFor();
    await page.screenshot({ path: `${evidence}/runs-loading.png`, fullPage: true });
    await page.getByText('Browser fixture').waitFor();

    const filters = [['Repository', 'repository_id', 'repo-1'], ['Wave', 'wave', 'W11'], ['Harness', 'harness', 'fixture'], ['Model', 'model', 'fixture-model'], ['Issue', 'issue_number', '31'], ['Pull request', 'pr_number', '32'], ['Started after', 'started_after', '2025-01-01'], ['Started before', 'started_before', '2026-01-01']];
    for (const [label, , value] of filters) await page.getByRole('textbox', { name: label }).fill(value);
    await page.waitForTimeout(100);
    const filterRequest = requests.at(-1);
    assert.deepEqual(filterRequest.query, { page: '1', per_page: '20', repository_id: 'repo-1', wave: 'W11', harness: 'fixture', model: 'fixture-model', issue_number: '31', pr_number: '32', started_after: '2025-01-01', started_before: '2026-01-01' });
    await page.getByRole('button', { name: 'fixture-run-1' }).click();
    await page.getByRole('heading', { name: 'Timeline (50 steps)' }).waitFor();
    assert.equal(await page.getByText('Cumulative cost $0.0050').count(), 1);
    assert.ok(timelineRequests.length > 0);

    mode = 'empty';
    await page.goto(`${url}/runs`);
    await page.getByText('No runs recorded.').waitFor();
    await page.screenshot({ path: `${evidence}/runs-empty.png`, fullPage: true });
    mode = 'error';
    await page.goto(`${url}/runs`);
    await page.getByText(/Unable to load runs:/).waitFor();
    await page.screenshot({ path: `${evidence}/runs-error.png`, fullPage: true });

    mode = 'large';
    await page.goto(`${url}/runs`);
    await page.getByText('Page 1 · 10000 runs').waitFor();
    const timelineStarted = performance.now();
    await page.getByRole('button', { name: 'fixture-run-1' }).click();
    await page.getByRole('heading', { name: 'Timeline (50 steps)' }).waitFor();
    const timelineMs = Math.round(performance.now() - timelineStarted);
    assert.ok(timelineMs < 1000, `50-step rendering took ${timelineMs}ms`);
    await page.screenshot({ path: `${evidence}/runs-timeline-50.png`, fullPage: true });
    fs.writeFileSync(`${evidence}/runs-browser.json`, JSON.stringify({ controlledFixture: true, fixtureRuns: 10000, servedRows: 1, listRenderMs: initialRenderMs, timelineSteps: 50, timelineRenderMs: timelineMs, filterRequest, requests }, null, 2));
    assert.deepEqual(errors, [], `browser page errors: ${errors.join('; ')}`);
    console.log(`Browser PASS; filters/data/empty/error/navigation verified; controlled 10k-run fixture (only one requested page row served); list render ${initialRenderMs}ms; 50-step timeline ${timelineMs}ms; screenshot/log=${evidence}/`);
  } finally { await browser.close(); }
} finally {
  if (server?.pid && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(5000)]);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
}
