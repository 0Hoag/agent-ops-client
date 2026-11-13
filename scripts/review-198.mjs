// Reuse the #183 persisted-fixture lifecycle without changing its Usage review.
// Run only through the owning repository's scripts/heavy.sh.
import { readFileSync } from 'node:fs';

let source = readFileSync(new URL('./review-183.mjs', import.meta.url), 'utf8');
const replacements = [
  ["const baselineRevision = '6bf1525350b9976432d04ed259a4b0b2c791ac14';", "const baselineRevision = 'd529794d1379c5991f0482013f6cb36d48b7894d';"],
  ["const overviewReview = process.argv.includes('--overview-195');", 'const overviewReview = false;'],
  ["const browserScript = overviewReview ? 'scripts/review-195-browser.mjs' : 'scripts/review-183-browser.mjs';", "const browserScript = 'scripts/review-198-browser.mjs';"],
  ["const artifacts = resolve(overviewReview ? '.agent-runs/W18-overview-truth-195' : '.agent-runs/W18R8-browser-183');", "const artifacts = resolve('.agent-runs/W18-shared-forms-198');"],
  ['`w18r8-183-${process.pid}`', '`w18-forms-198-${process.pid}`'],
  ["['src/modules/budgets/services/client.ts', 'src/modules/pricing/PricingPage.tsx']", "['src/style.css', 'src/shared/ui.tsx', 'src/modules/work/page.tsx', 'src/modules/settings/SettingsPage.tsx', 'src/modules/repositories/page.tsx', 'src/modules/waves/page.tsx', 'src/modules/alerts/page.tsx', 'src/modules/alerts/ChannelSettings.tsx']"],
  ["stage = 'seed';", "stage = 'seed'; await request('waves', { name: 'Readable batch', brief: 'Review only; do not launch agents.', state: 'todo' }, selected.token); await request('alerts/channels', { kind: 'slack', enabled: false, slack_webhook_url_env_ref: 'REVIEW_198_SLACK' }, selected.token);"],
  ['/Budgets regression: expected empty state, not a blank page/', '/Shared forms regression: computed contrast or state/'],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Review 183 lifecycle changed: ${before}`);
  source = source.replace(before, after);
}
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
