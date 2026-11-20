import assert from 'node:assert/strict';

export async function signIn(page) {
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login');
  await page.waitForLoadState('networkidle');
}

export async function capture(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const visible = (selector) => [...main.querySelectorAll(selector)].filter((node) => node.getClientRects().length);
    return { url: location.pathname + location.search + location.hash, text: main.getClientRects().length ? main.innerText : '',
      alerts: visible('[role="alert"]').map((node) => node.innerText),
      shellAlerts: [...document.querySelectorAll('header [role="alert"]')].filter((node) => !main.contains(node) && node.getClientRects().length).map((node) => node.innerText),
      shellActions: [...document.querySelectorAll('header button,header a')].filter((node) => !main.contains(node) && node.getClientRects().length).map((node) => node.innerText),
      loading: visible('[role="status"], [aria-label="Loading"]').map((node) => node.innerText || node.getAttribute('aria-label')),
      actions: visible('button,a').map((node) => node.innerText),
      width: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
}

export function emptyLists(body) {
  try {
    const empty = (value) => Array.isArray(value) ? [] : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, empty(child)])) : value;
    return JSON.stringify(empty(JSON.parse(body)));
  } catch { return body; }
}

export function classify(row) {
  if (!row.hits) return 'UNVERIFIED: target call not reached';
  if (row.errors.length || !row.result.text.trim()) return 'DEFECT: unhandled error or blank page';
  if (row.fault === '401') return row.sessionReturnPass ? 'PASS: login returns to exact destination' : 'DEFECT: session return';
  if (row.fault === 'slow') return row.early?.loading.length && !row.result.loading.length ? 'OBSERVED: loading then settled' : 'REVIEW: loading feedback or settlement';
  if (row.fault === 'empty') return 'REVIEW: inspect contextual empty action; arrays only emptied, scalar objects unchanged';
  try {
    assert([...row.result.alerts, ...(row.result.shellAlerts ?? [])].some((text) => /retry|try again/i.test(text)), 'Fault must show readable retryable error');
    assert([...row.result.actions, ...(row.result.shellActions ?? [])].some((text) => /retry|try again/i.test(text)), 'Retry action must exist');
    assert.equal(row.result.loading.length, 0, 'Fault must settle');
    return 'OBSERVED: retryable alert; retry recovery not asserted';
  } catch { return 'DEFECT: missing retryable alert or unsettled loading'; }
}
