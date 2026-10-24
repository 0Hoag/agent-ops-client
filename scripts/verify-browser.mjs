import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4319'], {
  cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const errors = [];
const evidence = 'artifacts/browser';
fs.mkdirSync(evidence, { recursive: true });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`dev server exited: ${output}`);
    try { if ((await fetch('http://127.0.0.1:4319')).status === 200) return; } catch {}
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
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource: the server responded with a status of 503')) errors.push(message.text());
    });
    let mode = 'health-loading';
    await page.route('**/healthz', async (route) => {
      if (mode === 'health-loading') await new Promise((resolve) => setTimeout(resolve, 2500));
      if (mode === 'health-error') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    });
    await page.goto('http://127.0.0.1:4319/');
    await page.getByRole('status').waitFor();
    await page.screenshot({ path: `${evidence}/health-loading.png`, fullPage: true });
    await page.getByText('API status:').waitFor();
    await page.screenshot({ path: `${evidence}/health-data.png`, fullPage: true });

    mode = 'health-error';
    await page.reload();
    await page.getByRole('alert').waitFor();
    await page.screenshot({ path: `${evidence}/health-error.png`, fullPage: true });

    await page.route('**/api/v1/repositories**', async (route) => {
      if (mode === 'repo-loading') await new Promise((resolve) => setTimeout(resolve, 700));
      if (mode === 'repo-error') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mode === 'repo-empty' ? [] : [{ id: 'repo-1', full_name: 'fixture/demo' }], meta: { page: 1, per_page: 100, total: 1 } }) });
    });
    await page.route('**/api/v1/board**', async (route) => {
      const result = mode === 'board-data'
        ? { data: [{ id: 'issue-1', number: 1, title: 'Fixture issue', state: 'open', status: 'todo', labels: [], pull_requests: [] }], meta: { page: 1, per_page: 100, total: 1 } }
        : { data: [], meta: { page: 1, per_page: 100, total: 0 } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    });
    mode = 'repo-loading';
    await page.goto('http://127.0.0.1:4319/board');
    await page.getByLabel('Loading repositories').waitFor();
    await page.screenshot({ path: `${evidence}/board-loading.png`, fullPage: true });
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    mode = 'board-empty';
    await page.getByText('No issues on this board.').waitFor();
    await page.screenshot({ path: `${evidence}/board-empty.png`, fullPage: true });

    mode = 'repo-error';
    await page.reload();
    await page.getByRole('alert').waitFor();
    await page.screenshot({ path: `${evidence}/board-error.png`, fullPage: true });

    mode = 'repo-data';
    await page.reload();
    await page.getByRole('combobox', { name: 'Repository' }).selectOption('repo-1');
    mode = 'board-data';
    await page.getByText('Fixture issue').waitFor();
    await page.screenshot({ path: `${evidence}/board-data.png`, fullPage: true });
    assert.deepEqual(errors, [], `browser console errors: ${errors.join('; ')}`);
    fs.writeFileSync(`${evidence}/console-errors.log`, 'No browser console/page errors.\n');
    console.log(`Browser fixture PASS; screenshots and console log: ${evidence}/; console errors: 0`);
  } finally {
    await browser.close();
  }
} finally {
  if (server.pid && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(5000)]);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
  if (server.pid) {
    try { process.kill(-server.pid, 0); throw new Error(`server process group ${server.pid} survived cleanup`); } catch (error) {
      if (error instanceof Error && error.message.includes('survived')) throw error;
    }
    console.log(`Browser server process group ${server.pid} cleanup verified`);
  }
}
