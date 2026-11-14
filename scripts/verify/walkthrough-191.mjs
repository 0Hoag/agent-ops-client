// Guided observation only: no mocked HTTP, product arithmetic or passing exemptions.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { performance } from 'node:perf_hooks';

const archive = '/Users/zeross/agent-ops-client/.agent-runs/W21c-walkthrough-191';
const dir = resolve('.agent-runs/W21c-walkthrough-191', String(Date.now()));
mkdirSync(dir, { recursive: true });
const result = { command: 'bash scripts/verify/walkthrough-191.sh', status: 'blocked', answers: [] };
let browser;
let input;
function save() {
  writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2));
  mkdirSync(archive, { recursive: true });
  cpSync(dir, `${archive}/${dir.split('/').at(-1)}`, { recursive: true });
}
try {
  const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
  writeFileSync(`${dir}/preflight.log`, `$ docker version --format '{{.Server.Version}}'\n${docker.stdout || ''}${docker.stderr || ''}\nexit=${docker.status}\n`);
  if (docker.status !== 0) throw new Error('Docker preflight failed; see preflight.log. No stack was created.');
  if (process.argv.includes('--preflight')) {
    result.status = 'preflight-only';
  } else {
    // The caller owns a fresh isolated stack and its teardown. Require archived provenance.
    const fixture = process.env.WALKTHROUGH_FIXTURE;
    const base = process.env.PRODUCT_E2E_URL;
    if (!base || !fixture || !existsSync(fixture)) {
      throw new Error('Require PRODUCT_E2E_URL and WALKTHROUGH_FIXTURE (persisted SQL + HTTP evidence JSON from a fresh isolated stack). No stack was created.');
    }
    cpSync(fixture, `${dir}/fixture.json`);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
    const http = [];
    page.on('response', async (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') && !url.pathname.includes('/auth/')) {
        try { http.push({ path: url.pathname + url.search, status: response.status(), body: await response.json() }); } catch { /* Non-JSON responses remain outside the numeric comparison. */ }
      }
    });
    let clicks = 0;
    let counting = false;
    await page.exposeFunction('walkthroughClick', () => { if (counting) clicks++; });
    await page.addInitScript(() => document.addEventListener('click', () => void window.walkthroughClick(), true));
    await page.goto(base);
    input = createInterface({ input: process.stdin, output: process.stdout });
    await input.question('Sign in through the UI with the sanctioned synthetic account, select the fixture organization, open Overview. Press Enter when ready. ');
    const start = performance.now();
    for (const [index, question] of [
      'What did AI cost this week?', 'Is it getting more efficient?', 'What needs attention?',
    ].entries()) {
      clicks = 0;
      counting = true;
      const began = performance.now();
      const answer = await input.question(`${question} Use only the UI. Enter the visible answer, date range and evidence; enter NOT FOUND if unavailable: `);
      const seconds = (performance.now() - began) / 1000;
      counting = false;
      const screenshot = `question-${index + 1}.png`;
      await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
      result.answers.push({ question, answer, seconds, clicks, url: page.url(), screenshot, found: answer.trim() !== '' && !answer.toUpperCase().includes('NOT FOUND') });
      save();
    }
    result.combinedSeconds = (performance.now() - start) / 1000;
    result.thresholds = { maxClicksPerAnswer: 3, combinedSecondsExclusive: 300 };
    writeFileSync(`${dir}/http.json`, JSON.stringify(http, null, 2));
    // Comparison is an explicit human observation, not an imported production oracle.
    result.comparison = await input.question('Compare each visible answer with fixture.json and http.json. Record exact persisted/HTTP/visible values, discrepancies and existing root issue links: ');
    result.status = 'observed-needs-review';
    if (result.answers.some((answer) => !answer.found || answer.clicks > 3) || result.combinedSeconds >= 300) {
      result.status = 'measured-threshold-failure';
      process.exitCode = 1;
    }
  }
} catch (error) {
  result.failure = error.stack;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  save(); // Archive evidence before closing the browser; never delete caller-owned resources.
  input?.close();
  await browser?.close();
  console.log(`Evidence: ${archive}/${dir.split('/').at(-1)}`);
}
