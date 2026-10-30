import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4321'], { cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const evidence = '.agent-runs/waves-empty-destination-browser';
fs.mkdirSync(evidence, { recursive: true });
let persistedBrief = 'Persisted starter brief';
let persistedState = 'todo';

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`dev server exited: ${output}`);
    try { if ((await fetch('http://127.0.0.1:4321')).status === 200) break; } catch {}
    if (attempt === 59) throw new Error(`server readiness timeout: ${output}`);
    await delay(500);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => { sessionStorage.setItem('agent-ops-token', 'fixture'); });
    await page.route('**/api/v1/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ organization_id: 'fixture-org' }) }));
    await page.route('**/api/v1/waves**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        if (typeof body.brief === 'string') persistedBrief = body.brief;
        if (typeof body.state === 'string') persistedState = body.state;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else {
        const waves = [{ id: 'fixture-wave', name: 'Browser fixture wave', state: persistedState, brief: persistedBrief }];
        if (persistedState !== 'todo') waves.push({ id: 'destination-wave', name: 'Empty in_progress destination', state: 'in_progress', brief: '' });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: waves }) });
      }
    });
    await page.goto('http://127.0.0.1:4321/waves');
    const editor = page.getByLabel('Brief for Browser fixture wave');
    await editor.waitFor();
    await page.getByLabel('State for Browser fixture wave').selectOption('in_progress');
    await page.getByRole('heading', { name: 'Empty in_progress destination' }).waitFor();
    await page.screenshot({ path: `${evidence}/todo-to-in_progress.png`, fullPage: true });
    fs.writeFileSync(`${evidence}/transition.txt`, 'PASS: browser fixture PATCH transitioned todo to in_progress; response reload placed the fixture wave in the previously empty in_progress column. Fixture evidence only; no live backend was used.\n');
    await page.reload();
    await editor.waitFor();
    await page.getByLabel('Brief template for Browser fixture wave').selectOption({ label: 'Release plan' });
    await editor.fill('Persisted browser-edited brief');
    await page.screenshot({ path: `${evidence}/edited.png`, fullPage: true });
    await page.getByRole('article').filter({ hasText: 'Browser fixture wave' }).getByRole('button', { name: 'Save brief' }).click();
    await page.getByText('Persisted browser-edited brief').waitFor();
    await page.reload();
    await editor.waitFor();
    assert.equal(await editor.inputValue(), 'Persisted browser-edited brief');
    await page.screenshot({ path: `${evidence}/reloaded.png`, fullPage: true });
    fs.writeFileSync(`${evidence}/result.txt`, 'PASS: fixture PATCH saved the edited brief; reloading fetched the persisted fixture brief. This is browser fixture evidence, not live backend evidence.\n');
    console.log(`Wave brief browser fixture PASS; evidence: ${evidence}/`);
  } finally { await browser.close(); }
} finally {
  if (server.pid && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), delay(5000)]);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
}
