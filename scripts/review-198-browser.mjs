// Real authentication and persisted Compose fixtures; no intercepted API routes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
mkdirSync(`${dir}/screenshots`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const matrix = [], failures = [], network = [], pending = [], errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (/\/api\/v1\/(work|repositories|waves|alerts)(\/|\?|$)/.test(response.url())) {
    pending.push(response.text().then((body) => network.push({ url: response.url(), status: response.status(), body })));
  }
});
const check = (condition, message) => { if (!condition) failures.push(message); };
async function measurements() {
  return page.evaluate(() => {
    // Tailwind v4 emits lab()/oklch(); numeric parsing would invent RGB ratios.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgb = (value) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const luminance = (value) => rgb(value).map((n) => { const s = n / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((a, n, i) => a + n * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const background = (el) => { for (let node = el; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color !== 'rgba(0, 0, 0, 0)') return color; } return 'rgb(255, 255, 255)'; };
    const sample = (el) => { const css = getComputedStyle(el), bg = background(el); return { text: el.textContent, color: css.color, background: bg, border: css.borderTopColor, borderWidth: css.borderTopWidth, contrast: contrast(css.color, bg), boundary: contrast(css.borderTopColor, bg), fill: contrast(bg, background(el.parentElement)), disabled: el.disabled }; };
    const row = document.querySelector('tbody tr');
    const controls = [...document.querySelectorAll('main input:not([type=checkbox]), main textarea, main select')].map(sample);
    const primary = [...document.querySelectorAll('main button.primary-action, main form > button:last-of-type')].map(sample);
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, row: row ? { background: background(row), cells: [...row.querySelectorAll('td, td p, td button')].map(sample) } : null, controls, primary };
  });
}
try {
  await page.goto(`${process.env.PRODUCT_E2E_URL}/work`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  for (const [name, path] of [['work-detail', '/work'], ['settings-repositories', '/settings/advanced#repositories'], ['repositories-direct', '/repositories'], ['advanced-batches', '/waves'], ['advanced-alerts', '/alerts']]) {
    await page.goto(`${process.env.PRODUCT_E2E_URL}${path}`);
    await page.waitForLoadState('networkidle');
    if (name === 'work-detail') {
      await page.locator('main').getByLabel('Repository', { exact: true }).selectOption(process.env.W18_REPOSITORY);
      await page.locator('tbody tr button').first().waitFor();
    }
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        if (name === 'work-detail') {
          const row = page.locator('tbody tr').first();
          await row.locator('button').click();
          const detail = page.getByRole('region', { name: 'Selected work details' });
          await detail.locator('h2').waitFor();
          check(await detail.evaluate((el) => document.activeElement === el), `${theme}/${width}: detail focus`);
          const box = await detail.boundingBox();
          check(box.y >= 0 && box.y < 844, `${theme}/${width}: detail reachable`);
          if (width === 1280) check(box.height < await page.locator('table').evaluate((el) => el.offsetHeight), 'Desktop detail must not stretch to table height');
          const selected = await measurements();
          check((await row.getAttribute('aria-selected')) === 'true', `${theme}/${width}: selected row state`);
          await row.locator('button').hover();
          const hovered = await measurements();
          for (const state of [selected, hovered]) for (const cell of state.row.cells) check(cell.contrast >= 4.5, `${theme}/${width}: row text contrast ${cell.contrast}`);
          matrix.push({ name, theme, width, state: 'selected', ...selected });
          matrix.push({ name, theme, width, state: 'row-hover', ...hovered });
          await detail.scrollIntoViewIfNeeded();
        }
        const result = await measurements();
        check(result.documentWidth <= width, `${name}/${theme}/${width}: horizontal overflow`);
        for (const field of result.controls) { check(field.boundary >= 3 && parseFloat(field.borderWidth) >= 1, `${name}/${theme}/${width}: input boundary ${field.boundary}`); check(field.contrast >= 4.5, `${name}: field text contrast`); }
        for (const button of result.primary.filter((button) => !button.disabled)) { check(button.contrast >= 4.5, `${name}/${theme}: primary text contrast`); check(button.fill >= 3, `${name}/${theme}: primary fill contrast`); }
        if (name !== 'work-detail') check(result.primary.length === 1, `${name}: one primary action`);
        if (result.primary.length) {
          await page.locator('main button.primary-action, main form > button:last-of-type').first().hover();
          const hovered = await measurements();
          for (const button of hovered.primary.filter((button) => !button.disabled)) check(button.contrast >= 4.5 && button.fill >= 3, `${name}/${theme}/${width}: primary hover contrast`);
          matrix.push({ name, theme, width, state: 'primary-hover', ...hovered });
        }
        const screenshot = `screenshots/${name}-${theme}-${width}.png`;
        await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
        matrix.push({ name, theme, width, screenshot, ...result });
      }
    }
    if (name === 'advanced-alerts') {
      const method = page.getByLabel('Notification method');
      for (const [kind, count] of [['slack', 1], ['smtp', 6], ['telegram', 2]]) {
        await method.selectOption(kind);
        check(await page.getByPlaceholder('Environment variable name').count() === count, `${kind}: only relevant provider fields`);
      }
    }
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  assert.deepEqual(failures, [], 'Shared forms regression: computed contrast or state');
  console.log('PASS computed contrast, field boundaries, primary actions, provider selection, mobile focus/reachability; 20 screenshots');
} finally {
  writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
  writeFileSync(`${dir}/failures.json`, JSON.stringify(failures, null, 2));
  writeFileSync(`${dir}/network.json`, JSON.stringify(await Promise.all(pending).then(() => network), null, 2));
  writeFileSync(`${dir}/page-errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
