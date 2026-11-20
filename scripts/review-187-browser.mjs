// Real persisted Compose data and actual login; invoke via heavy.sh and review-183.mjs --accessibility-187.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { keyboardReview } from './review-187-keyboard.mjs';

const require = createRequire(import.meta.url);
const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
mkdirSync(`${dir}/screenshots`, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 }, reducedMotion: 'reduce' });
const matrix = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const save = (name, value) => writeFileSync(`${dir}/${name}.json`, JSON.stringify(value, null, 2));
const screens = [
  ['overview', '/'], ['work', '/work'], ['detail', '/work'], ['usage', '/usage'],
  ['repositories', '/settings/advanced#repositories'], ['prices', '/settings/advanced#model-prices'],
  ['members', '/settings/advanced#members'], ['agent-setup', '/settings/advanced#agent-setup'],
  ['advanced', '/settings/advanced#advanced'],
];
try {
  await page.goto(`${base}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  for (const [name, path] of screens) {
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle');
    if (['work', 'detail'].includes(name)) {
      await page.locator('main').getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
      await page.waitForLoadState('networkidle');
      if (name === 'detail') {
        await page.getByRole('textbox', { name: 'Search work', exact: true }).fill('Improve hosting deployment 1');
        await page.getByRole('button', { name: 'Improve hosting deployment 1', exact: true }).click();
        await page.locator('aside h2').waitFor();
      }
    }
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      for (const width of [390, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 844 });
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        const measurement = await page.evaluate(async () => {
          const axe = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
          return {
            documentWidth: document.documentElement.scrollWidth,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            animations: document.getAnimations().map((animation) => ({ state: animation.playState, duration: animation.effect?.getTiming().duration })),
            violations: axe.violations, incomplete: axe.incomplete,
          };
        });
        const screenshot = [390, 1280].includes(width) ? `screenshots/${name}-${theme}-${width}.png` : null;
        if (screenshot) await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
        matrix.push({ name, path, theme, width, screenshot, ...measurement });
        save('matrix', matrix);
        console.log(`${name}/${theme}/${width}: document=${measurement.documentWidth}; serious/critical=${measurement.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).length}; incomplete=${measurement.incomplete.length}`);
      }
    }
  }
  assert.equal(matrix.length, screens.length * 8);
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto(`${base}/`);
  await page.waitForLoadState('networkidle');
  save('accessibility-tree', await page.locator('body').ariaSnapshot());
  const groups = [];
  for (const name of ['Current organization', 'Date range presets', 'Daily spend chart']) {
    groups.push({ name, count: await page.getByRole('group', { name, exact: true }).count() });
  }
  save('named-groups', groups);
  assert(groups.every((group) => group.count === 1), 'Named accessibility groups must expose organization, date presets and daily spend');
  for (const cell of matrix) {
    assert(cell.documentWidth <= cell.width, `Page overflow: ${cell.name}/${cell.theme}/${cell.width}`);
    assert.equal(cell.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).length, 0);
    assert.equal(cell.reducedMotion, true);
    assert.equal(cell.animations.filter((a) => a.state === 'running').length, 0);
  }
  const keyboard = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 768, 1280, 1920]) {
      keyboard.push({ theme, width, results: await keyboardReview(page, base, process.env.W18_REPOSITORY, width, theme) });
      save('keyboard', keyboard);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS 72 responsive/axe/reduced-motion cells, named groups and keyboard flow');
} finally {
  save('page-errors', errors);
  await browser.close();
}
