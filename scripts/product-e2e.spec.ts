import { test, expect } from 'playwright/test';
import { writeFileSync } from 'node:fs';

test('anonymous route guard and real login, board, runs, alerts', async ({ page }, testInfo) => {
  const requests: { method: string; path: string; status: number }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) requests.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  });
  const responseFor = (path: string) => page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/${path}` && response.request().method() === 'GET');
  const emptyResponse = async (response: Awaited<ReturnType<typeof responseFor>>) => {
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data ?? []).toEqual([]);
    expect(body.meta.total).toBe(0);
  };
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const path of ['/board', '/runs', '/alerts']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true }), `anonymous route guard: ${path}`).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    }
    await page.goto('/board');
    await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL!);
    await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD!);
    const login = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login'));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    expect((await login).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Select an organization', exact: true })).toBeVisible();
    await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Product E2E' });
    const selection = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/select-organization'));
    const repositories = responseFor('repositories');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect((await selection).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Issue board', exact: true })).toBeVisible();
    const repositoryResponse = await repositories;
    expect(repositoryResponse.status()).toBe(200);
    const repositoryData = (await repositoryResponse.json()).data;
    expect(repositoryData).toHaveLength(1);
    expect(repositoryData[0].full_name).toBe('product/e2e');
    const board = responseFor('board');
    await page.getByRole('main').getByLabel('Repository', { exact: true }).selectOption(repositoryData[0].id);
    await emptyResponse(await board);
    await expect(page.getByText('No issues on this board.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Current organization', { exact: true })).toHaveText('Product E2E');
    await expect(page.getByRole('main').getByLabel('Repository', { exact: true })).toHaveValue(repositoryData[0].id);
    await page.screenshot({ path: testInfo.outputPath('board.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('main').getByLabel('Repository', { exact: true })).toHaveValue(repositoryData[0].id);
    await page.screenshot({ path: testInfo.outputPath('board-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    const runs = responseFor('agent-runs');
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agent runs', exact: true })).toBeVisible();
    await emptyResponse(await runs);
    await expect(page.getByText('No runs recorded.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('runs.png'), fullPage: true });

    const alerts = responseFor('alerts/history');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
    await page.getByRole('link', { name: 'Alerts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alert history', exact: true })).toBeVisible();
    await emptyResponse(await alerts);
    await expect(page.getByText('No alert history found.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('alerts.png'), fullPage: true });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByText('User menu', { exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(requests.some((entry) => entry.path.endsWith('/auth/session') && entry.status === 200)).toBe(true);
  } finally {
    writeFileSync(testInfo.outputPath('requests.json'), JSON.stringify({ requests, errors }, null, 2));
  }
});
