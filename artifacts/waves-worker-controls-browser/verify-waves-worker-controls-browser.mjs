import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4321'], { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const evidence = '/Users/zeross/agent-ops-client/.agent-runs/W14o-worker-controls-browser';
fs.mkdirSync(evidence, { recursive: true });
const request = { wave: 'fixture-wave', branch: 'fixture-branch', worktree: '/tmp/fixture-worktree', script: 'pnpm test', brief: 'Fixture brief' };
let job = { ID: 'fixture-job', State: 'queued', Request: request };
const log = [];
try {
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch('http://127.0.0.1:4321')).status === 200) break; } catch {} if (i === 59) throw new Error(`server readiness timeout: ${output}`); await delay(500); }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('console', (msg) => log.push(`console ${msg.type()}: ${msg.text()}`));
    page.on('request', (req) => log.push(`request ${req.method()} ${req.url()}`));
    await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture'));
    await page.route('**/api/v1/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organization_id: 'fixture-org', account_id: 'fixture-account' }) }));
    await page.route('**/api/v1/organizations/fixture-org/members', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ account_id: 'fixture-account', role: 'owner' }] }) }));
    await page.route('**/api/v1/waves', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: request.wave, name: 'Fixture wave', state: 'todo', brief: request.brief }] }) }));
    await page.route('**/api/v1/workers/**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET' && route.request().method() !== 'POST') return route.continue();
      if (route.request().method() === 'POST' && (url.pathname.endsWith('/start') || url.pathname.endsWith('/restart'))) { assert.deepEqual(route.request().postDataJSON(), request); log.push(`${url.pathname} request ${JSON.stringify(request)}`); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: job }) }); }
      else if (url.pathname.endsWith('/stop')) { log.push(`${url.pathname} stop`); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'stopped' }) }); }
      else if (url.pathname.endsWith('/fixture-job')) { job = { ...job, State: 'running' }; log.push('GET job status running'); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: job }) }); }
      else await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'fixture validation: script rejected' }) });
    });
    await page.goto('http://127.0.0.1:4321/waves');
    for (const [field, value] of Object.entries(request)) await page.getByLabel(`Worker ${field}`).fill(value);
    await page.getByRole('button', { name: 'Start worker', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh status' }).waitFor();
    await page.screenshot({ path: `${evidence}/started.png`, fullPage: true });
    await page.getByRole('button', { name: 'Refresh status' }).click();
    await page.getByText('Worker fixture-job: running').waitFor();
    await page.getByRole('button', { name: 'Stop worker' }).click();
    await page.getByRole('button', { name: 'Restart worker' }).click();
    await page.getByRole('button', { name: 'Restart worker' }).waitFor();
    await page.screenshot({ path: `${evidence}/lifecycle.png`, fullPage: true });
    await page.route('**/api/v1/workers/start', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'fixture validation: script rejected' }) }));
    await page.getByRole('button', { name: 'Start worker', exact: true }).click();
    await page.getByRole('alert').waitFor();
    await page.screenshot({ path: `${evidence}/rejected.png`, fullPage: true });
    log.push('ERROR expected fixture rejection: fixture validation: script rejected');
    fs.writeFileSync(`${evidence}/browser.log`, `FIXTURE-ONLY; no live backend used\n${log.join('\n')}\n`);
    fs.writeFileSync(`${evidence}/result.txt`, 'PASS: browser fixture demonstrated start, status refresh, stop, restart with the original request, and a rejected start. Fixture-only evidence; no live API evidence.\n');
    console.log(`Worker controls browser fixture PASS; evidence: ${evidence}`);
  } finally { await browser.close(); }
} finally { if (server.pid && server.exitCode === null) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} } }
