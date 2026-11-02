import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('.agent-runs/w14r-audit-history', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) requests.push(`${request.method()} ${request.url()}`); });
  const acceptedRow = { id: 'accepted-action', actorID: 'Fixture Owner', occurredAt: '2026-04-01T12:00:00Z', action: 'worker.start', wave: 'Release 1', jobID: 'job-accepted', outcome: 'accepted' };
  const rejectedRow = { id: 'rejected-action', actorID: 'Fixture Owner', occurredAt: '2026-04-01T12:01:00Z', action: 'worker.start', wave: 'Release 1', jobID: 'job-rejected', outcome: 'rejected' };
  let lifecycle = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname.endsWith('/auth/session')) body = { organization_id: 'fixture-org', account_id: 'fixture-user' };
    else if (url.pathname.endsWith('/workers/audit-history')) body = { data: lifecycle, meta: { page: 1, per_page: 10, total: lifecycle.length } };
    else if (url.pathname.endsWith('/waves')) body = { data: [] };
    else if (url.pathname.endsWith('/workers/start')) { const input = JSON.parse(route.request().postData() ?? '{}'); if (input.wave === 'Rejected Wave') { lifecycle = [rejectedRow, ...lifecycle]; body = { message: 'Worker rejected', status: 409 }; } else { lifecycle = [acceptedRow, ...lifecycle]; body = { data: { ID: 'job-accepted', State: 'queued', Request: input } }; } }
    else if (url.pathname.endsWith('/organizations/fixture-org/members')) body = { data: [{ account_id: 'fixture-user', role: 'owner' }] };
    else body = { data: { ID: 'job-accepted', State: 'queued' } };
    const status = url.pathname.endsWith('/workers/start') && JSON.parse(route.request().postData() ?? '{}').wave === 'Rejected Wave' ? 409 : 200;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  page.on('console', (message) => console.log(`console ${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`));
  await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture-token'));
  await page.goto('http://127.0.0.1:18764/waves');
  await page.getByRole('heading', { name: 'Organization waves' }).waitFor();
  await page.getByLabel('Worker wave').fill('Accepted Wave');
  await page.getByRole('button', { name: 'Start worker', exact: true }).click();
  await page.getByText('Worker job-accepted: queued').waitFor();
  await page.getByLabel('Worker wave').fill('Rejected Wave');
  await page.getByRole('button', { name: 'Start worker', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Worker audit history"]')?.innerText.includes('job-rejected'));
  await page.getByRole('alert').filter({ hasText: 'Worker action failed' }).waitFor();
  await page.getByLabel('Worker audit history').getByText('job-rejected').waitFor();
  await page.getByText('job-accepted').first().waitFor();
  assert(requests.some((request) => request.includes('/workers/start')));
  await page.screenshot({ path: '.agent-runs/w14r-audit-history/worker-audit-history.png', fullPage: true });
  await import('node:fs/promises').then(({ writeFile }) => writeFile('.agent-runs/w14r-audit-history/browser.log', `BROWSER PASS (mocked persistence fixture; not live API)\nAccepted and rejected worker lifecycle outcomes rendered in audit history.\n${requests.join('\n')}\n`));
  console.log('BROWSER PASS (mocked persistence fixture; not live API): accepted and rejected worker actions appear in audit history.');
} finally { await browser.close(); }
