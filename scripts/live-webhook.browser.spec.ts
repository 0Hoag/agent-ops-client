import { createHmac } from 'node:crypto';
import { expect, test } from 'playwright/test';

const api = process.env.APP_API_URL || 'http://127.0.0.1:18080';
const secretA = process.env.SMOKE_WEBHOOK_SECRET || 'w2e-local-secret-a';

async function sendIssue(page: import('playwright/test').Page, repo: string, number: number, title: string, label: string) {
  const body = JSON.stringify({ action: 'labeled', repository: { full_name: repo }, issue: { id: number, number, title, state: 'open', labels: [{ name: label }], updated_at: new Date().toISOString() } });
  const signature = createHmac('sha256', secretA).update(body).digest('hex');
  const response = await page.request.post(`${api}/api/v1/webhooks/github`, { data: body, headers: { 'Content-Type': 'application/json', 'X-GitHub-Event': 'issues', 'X-GitHub-Delivery': `w2e-${number}-${Date.now()}`, 'X-Hub-Signature-256': `sha256=${signature}` } });
  expect(response.status(), await response.text()).toBe(200);
}

test('signed webhook invalidates selected repository live; old repo and unmount sockets are closed', async ({ page }) => {
  const ws: Array<{ url: string; socket: import('playwright/test').WebSocket }> = [];
  const requests: string[] = [];
  page.on('websocket', (socket) => { ws.push({ url: socket.url(), socket }); });
  page.on('request', (request) => { if (request.url().includes('/api/v1/board?')) requests.push(request.url()); });
  await page.goto('/board');
  const selector = page.getByRole('combobox', { name: 'Repository' });
  await expect(selector).toBeEnabled();
  await selector.selectOption({ label: 'w2e/a' });
  const repoA = await page.locator('option', { hasText: 'w2e/a' }).getAttribute('value');
  const repoB = await page.locator('option', { hasText: 'w2e/b' }).getAttribute('value');
  expect(repoA).toBeTruthy(); expect(repoB).toBeTruthy();
  await expect.poll(() => ws.some(({ url }) => url.includes(`repository_id=${repoA}`))).toBeTruthy();
  await sendIssue(page, 'w2e/a', 99201, 'W2e signed movement fixture', 'status:todo');
  await expect(page.getByText('W2e signed movement fixture')).toBeVisible();
  const todo = page.locator('div.rounded.bg-slate-100').filter({ has: page.getByRole('heading', { name: 'Todo' }) });
  await expect(todo.getByText('W2e signed movement fixture')).toBeVisible();
  const socketA = ws.find(({ url }) => url.includes(`repository_id=${repoA}`));
  expect(socketA).toBeTruthy();
  const aCount = requests.filter((url) => url.includes(`repository_id=${repoA}`)).length;
  await selector.selectOption(repoB!);
  await expect.poll(() => socketA!.socket.isClosed()).toBeTruthy();
  await page.waitForTimeout(300);
  const afterSwitch = requests.filter((url) => url.includes(`repository_id=${repoA}`)).length;
  expect(afterSwitch).toBe(aCount);
  await sendIssue(page, 'w2e/a', 99201, 'W2e signed movement fixture', 'status:review');
  await page.waitForTimeout(500);
  expect(requests.filter((url) => url.includes(`repository_id=${repoA}`)).length).toBe(afterSwitch);
  await selector.selectOption('');
  await expect.poll(() => ws.every(({ socket }) => socket.isClosed())).toBeTruthy();
  console.log('PASS signed webhook moved card; repo switch closed old socket and ignored old repo event; navigation closed socket');
});
