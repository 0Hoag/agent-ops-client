import assert from 'node:assert/strict';

/** Exercise native keyboard controls without pointer activation or mocked requests. */
export async function keyboardReview(page, base, repository, width, theme) {
  const results = [];
  const focus = async (control) => {
    // Find controls by real Tab order rather than programmatic focus.
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press('Tab');
      if (await control.evaluate((el) => el === document.activeElement)) {
        const ring = await control.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
        });
        assert.notEqual(ring.style, 'none', 'Keyboard target needs visible outline');
        assert.notEqual(ring.width, '0px');
        return;
      }
    }
    assert.fail(`Control unreachable by Tab: ${await control.textContent()}`);
  };
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}/work`);
  await page.waitForLoadState('networkidle');
  await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
  if (width < 768) {
    await focus(page.getByRole('button', { name: 'Open navigation' }));
    await page.keyboard.press('Enter');
  }
  await focus(page.getByRole('link', { name: 'Work', exact: true }));
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Close navigation' }).isVisible(), false);
  results.push('Work navigation activated by keyboard; mobile drawer closed');
  const repo = page.locator('main').getByRole('combobox', { name: 'Repository', exact: true });
  await focus(repo);
  await page.keyboard.type('review-183/hosting');
  await page.keyboard.press('Tab');
  assert.equal(await repo.inputValue(), repository);
  const search = page.getByRole('textbox', { name: 'Search work' });
  await focus(search);
  await page.keyboard.type('Improve hosting deployment 1');
  await focus(page.getByRole('combobox', { name: 'Status', exact: true }));
  await page.keyboard.type('Open');
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('combobox', { name: 'Status', exact: true }).inputValue(), 'open');
  await page.waitForLoadState('networkidle');
  const row = page.getByRole('button', { name: 'Improve hosting deployment 1', exact: true });
  await focus(row);
  await page.keyboard.press('Enter');
  await page.getByRole('region', { name: 'Selected work details' }).getByRole('heading', { level: 2 }).waitFor();
  assert(await page.getByRole('region', { name: 'Selected work details' }).evaluate((el) => el === document.activeElement));
  await focus(page.getByRole('button', { name: 'Back to selected work' }));
  await page.keyboard.press('Enter');
  assert(await row.evaluate((el) => el === document.activeElement));
  results.push('Repository/status filters, search, row details and return focus passed');
  await page.goto(`${base}/settings/advanced#repositories`);
  await page.waitForLoadState('networkidle');
  await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
  await focus(page.getByRole('tab', { name: 'Repositories', exact: true }));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const prices = page.getByRole('tab', { name: 'Model prices', exact: true });
  assert.equal(await prices.getAttribute('aria-selected'), 'true');
  assert(await prices.evaluate((el) => el === document.activeElement));
  await page.getByRole('heading', { name: 'Add price version' }).waitFor();
  const model = page.getByLabel('Model', { exact: true });
  await focus(model);
  const name = `keyboard-review-${Date.now()}`;
  await page.keyboard.type(name);
  await focus(page.getByRole('button', { name: 'Create version', exact: true }));
  const response = page.waitForResponse((res) => res.request().method() === 'POST' && res.url().includes('/agent-run-prices'));
  await page.keyboard.press('Enter');
  assert.equal((await response).status(), 201);
  // At mobile widths the visible data-label pseudo-content is part of the cell's accessible name.
  await page.getByRole('cell', { name: width < 640 ? `Model ${name}` : name, exact: true }).waitFor();
  results.push('Settings arrow navigation, visible focus, keyboard form submit persisted a price (HTTP 201)');
  return results;
}
