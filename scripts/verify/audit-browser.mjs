// Real Settings entry point, API, Postgres and WebSocket; only the worker is a fixture.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.PRODUCT_E2E_URL;
const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const fixture = JSON.parse(process.env.SETTINGS_FIXTURE);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.setDefaultTimeout(15000);
const network = [], errors = [], frames = [], auditResponses = [];
const sessions = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', async (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith('/api/')) network.push({ path, status: response.status() });
  if (path === '/api/v1/workers/audit-history') auditResponses.push({ status: response.status(), body: await response.json() });
  if (path === '/api/v1/auth/session' && response.status() === 200) {
    try { sessions.push(await response.json()); } catch { /* A previous document may have navigated away. */ }
  }
});
page.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => frames.push(String(payload))));
let result;
try {
  await page.goto(`${base}/settings/advanced#advanced`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('form').getByLabel('Organization', { exact: true }).selectOption(fixture.org);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('navigation', { name: 'Advanced controls' }).getByRole('link', { name: 'Logs', exact: true }).click();
  const controls = page.getByRole('region', { name: 'Advanced agent controls' });
  for (const [label, value] of Object.entries({ Batch: 'settings-190', Branch: 'verify/settings-190', 'Working folder': '/fixtures', Tool: 'settings-fixture', Brief: '/fixtures/brief.md' })) await controls.getByLabel(label, { exact: true }).fill(value);
  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/workers/start' && r.request().method() === 'POST');
  const audited = page.waitForResponse(async (r) => new URL(r.url()).pathname === '/api/v1/workers/audit-history' && (await r.json()).data?.length > 0);
  await controls.getByRole('button', { name: 'Start agent' }).click();
  const start = await started;
  assert.equal(start.status(), 201);
  const job = (await start.json()).data;
  const response = await audited;
  assert.equal(response.status(), 200);
  const body = await response.json();
  writeFileSync(`${dir}/audit-http.json`, JSON.stringify({ status: response.status(), body }, null, 2));
  const record = body.data.find((row) => row.JobID === job.ID);
  assert(record, 'AUDIT_REAL_JOB_LINK');
  // Identity is observed from the UI's own authenticated session, never injected.
  assert(sessions.some((session) => session.account_id === record.ActorID && session.organization_id === record.OrganizationID), 'AUDIT_SESSION_ACTOR');
  assert.equal(record.OrganizationID, fixture.org);
  assert.equal(record.Action, 'start');
  assert.equal(record.Outcome, 'accepted');
  assert.equal(record.Wave, 'settings-190');
  assert(Number.isFinite(Date.parse(record.OccurredAt)));
  const logs = page.getByRole('region', { name: 'Live logs' });
  await logs.getByText('settings-worker-start:settings-190', { exact: true }).waitFor();
  await logs.getByText('settings-worker-finish:settings-190', { exact: true }).waitFor();
  await logs.getByText('Agent completed.', { exact: true }).waitFor();
  assert(frames.some((frame) => frame.includes('worker.completed')));
  const row = page.getByRole('region', { name: 'Agent audit history' }).getByRole('article');
  await row.waitFor();
  const text = await row.innerText();
  assert(text.includes('Actor recorded') && text.includes('start') && text.includes('Batch settings-190') && text.includes(job.ID) && text.includes('accepted') && !/not recorded|not reported|not assigned|No agent task linked/.test(text), `AUDIT_ACCEPTED_START_ROW: ${text}`);
  assert.equal(await row.locator('time').getAttribute('dateTime'), record.OccurredAt, 'AUDIT_REAL_TIME');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await row.scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `AUDIT_NO_OVERFLOW_${width}`);
    await page.screenshot({ path: `${dir}/audit-${width}.png` });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(network.filter((item) => item.status >= 400), []);
  result = { acceptance: 'AUDIT_ACCEPTED_START_ROW', text, job: job.ID, outcome: 'PASS' };
  console.log(`PASS AUDIT_ACCEPTED_START_ROW: ${text}; HTTP start 201, audit 200; real completion; 1280/390 screenshots`);
} catch (error) {
  result = { outcome: 'FAIL', error: error.stack };
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(`${dir}/results.json`, JSON.stringify({ result, network, errors, frames, auditResponses }, null, 2));
  await browser.close();
}
