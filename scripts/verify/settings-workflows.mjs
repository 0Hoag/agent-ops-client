import assert from 'node:assert/strict';
import { request } from 'node:http';

/** Captures production panels in both CSS themes, without replacing runtime assertions. */
export async function screenshots({ page, dir, pass }, name) {
  for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 844 });
    // Production has theme tokens but no registered theme switch. Only presentation is changed.
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `SETTINGS_NO_OVERFLOW_${name}_${width}_${theme}`);
    await page.screenshot({ path: `${dir}/${name}-${width}-${theme}.png`, fullPage: true });
    pass(`SETTINGS_SCREENSHOT_${name}_${width}_${theme}`, `viewport ${width}; CSS theme ${theme}; screenshot`, 'production panel; no document overflow');
  }
  await page.setViewportSize({ width: 1280, height: 844 });
}

/** Exercises real repository form, connection test, persisted sync and the synced Work item. */
export async function repositorySettings(h) {
  const { page, goto, action, pass } = h;
  await page.getByRole('heading', { name: 'Add repository', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Test connection', exact: true }).count(), 1, 'SETTINGS_TEST_CONNECTION_REGISTERED');
  await page.getByLabel('Provider').selectOption('gitlab');
  await page.getByLabel('Full name', { exact: true }).fill('settings-190/connected');
  await page.getByLabel('Self-hosted base URL').fill(process.env.SETTINGS_PROVIDER);
  await page.getByLabel('Webhook credential').fill('settings-local-webhook-secret');
  await page.getByLabel('Backfill credential').fill('settings-local-provider-token');
  await action('repositories/test', 'POST', () => page.getByRole('button', { name: 'Test connection', exact: true }).click());
  await page.getByText('Connected to Settings fixture project.', { exact: true }).waitFor();
  const created = await action('repositories', 'POST', () => page.getByRole('button', { name: 'Create repository', exact: true }).click(), 201);
  const id = created.data.id;
  await page.reload();
  const article = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'settings-190/connected (gitlab)', exact: true }) });
  await article.waitFor();
  const synced = await action(`repositories/${id}/sync`, 'POST', () => article.getByRole('button', { name: 'Sync now', exact: true }).click());
  assert.equal(synced.data.last_sync_status, 'success', 'SETTINGS_SYNC_HTTP');
  assert(synced.data.last_synced_at, 'SETTINGS_SYNC_TIMESTAMP');
  await article.getByText('Sync status: success', { exact: true }).waitFor();
  await screenshots(h, 'repositories');
  await goto('/work');
  await page.getByLabel('Repository', { exact: true }).last().selectOption(id);
  await page.getByRole('button', { name: 'Settings synced task', exact: true }).waitFor();
  pass('SETTINGS_REPOSITORY_TEST_CREATE_SYNC', 'Settings → GitLab fixture → Test connection → Create → reload → Sync now → Work', 'HTTP 200/201/200; persisted repository; success timestamp; synced task visible');
}

/** Uses the registered Advanced links for persisted budgets, thresholds, channels and live logs. */
export async function advancedSettings(h) {
  const { page, goto, action, pass, frames } = h;
  const advanced = async (name) => {
    await goto('/settings/advanced#advanced');
    await page.getByRole('navigation', { name: 'Advanced controls' }).getByRole('link', { name, exact: true }).click();
  };
  await advanced('Budgets');
  await page.getByLabel('Start date').fill('2026-01-01');
  await page.getByLabel('End date').fill('2026-12-31');
  await page.getByLabel('Token limit').fill('2000000');
  await page.getByLabel('USD limit').fill('25');
  await action('budgets', 'POST', () => page.getByRole('button', { name: 'Create budget', exact: true }).click(), 201);
  await page.reload();
  await page.getByText('Token limit: 2000000; USD limit: 25', { exact: true }).waitFor();
  await screenshots(h, 'budgets');
  pass('SETTINGS_BUDGET_PERSISTED', 'Advanced → Budgets → create dated 2M-token/$25 budget → reload', 'same limits after real reload');
  await advanced('Alerts');
  await page.getByLabel('Minimum cache-hit rate (0–1)').fill('0.75');
  await page.getByLabel('Agent inactivity threshold (seconds)').fill('600');
  await page.getByLabel('Pull request inactivity threshold (seconds)').fill('7200');
  await action('alerts/thresholds', 'PUT', () => page.getByRole('button', { name: 'Save thresholds' }).click());
  await page.getByLabel('Slack webhook URL reference').fill('SETTINGS_FIXTURE_SLACK_URL');
  await action('alerts/channels', 'POST', () => page.getByRole('button', { name: 'Create channel' }).click(), 201);
  await page.reload();
  await page.waitForFunction((input) => input.value === '0.75', await page.getByLabel('Minimum cache-hit rate (0–1)').elementHandle());
  assert.equal(await page.getByLabel('Minimum cache-hit rate (0–1)').inputValue(), '0.75', 'SETTINGS_THRESHOLD_PERSISTED');
  await page.getByRole('region', { name: 'Notification channels' }).getByRole('button', { name: 'Disable', exact: true }).waitFor();
  await screenshots(h, 'alerts');
  pass('SETTINGS_ALERTS_PERSISTED', 'Advanced → Alerts → save .75/600/7200 thresholds; create synthetic Slack env reference; reload', 'persisted threshold + enabled channel; no external delivery claimed');
  await advanced('Logs');
  const controls = page.getByRole('region', { name: 'Advanced agent controls' });
  for (const [label, value] of Object.entries({ Batch: 'settings-190', Branch: 'verify/settings-190', 'Working folder': '/fixtures', Tool: 'settings-fixture', Brief: '/fixtures/brief.md' })) await controls.getByLabel(label, { exact: true }).fill(value);
  const job = await action('workers/start', 'POST', () => controls.getByRole('button', { name: 'Start agent' }).click(), 201);
  const logs = page.getByRole('region', { name: 'Live logs' });
  await logs.getByText('settings-worker-start:settings-190', { exact: true }).waitFor();
  await logs.getByText('settings-worker-finish:settings-190', { exact: true }).waitFor();
  await logs.getByText('Agent completed.', { exact: true }).waitFor();
  assert(frames.some((frame) => frame.includes('worker.log') && frame.includes('settings-worker-finish:settings-190')), 'SETTINGS_REAL_LOG_FRAME');
  assert(frames.some((frame) => frame.includes('worker.completed')), 'SETTINGS_REAL_COMPLETION_FRAME');
  const rejected = await new Promise((done, reject) => {
    const req = request(`${process.env.PRODUCT_E2E_URL}/api/v1/workers/${job.data.ID}/logs?access_token=deliberately-invalid`, { headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'c2V0dGluZ3MtMTkwLXRlc3Q=' } }, (response) => { response.resume(); done(response.statusCode); });
    req.on('error', reject); req.on('upgrade', (_response, socket) => { socket.destroy(); done(101); }); req.end();
  });
  assert.equal(rejected, 401, 'SETTINGS_LOGS_REJECT_INVALID_TOKEN');
  pass('SETTINGS_LOGS_REJECT_INVALID_TOKEN', 'real worker-log upgrade with deliberately invalid credential', 'HTTP 401; upstream session validation remains enforced');
  await screenshots(h, 'logs');
  pass('SETTINGS_REAL_WORKER_LOGS', 'Advanced → Logs → start allowlisted local fixture tool; observe real websocket', 'two deterministic process stdout lines + worker.completed rendered');
}
