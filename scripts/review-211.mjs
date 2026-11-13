// Reuse the existing real-stack lifecycle; only the permission consumers change in the control.
import { readFileSync } from 'node:fs';

let source = readFileSync(new URL('./review-183.mjs', import.meta.url), 'utf8');
const replacements = [
  ["const baselineRevision = '6bf1525350b9976432d04ed259a4b0b2c791ac14';", "const baselineRevision = '18dfe224ce14eb07790aa1f7fe038e72d409526e';"],
  ["const browserScript = overviewReview ? 'scripts/review-195-browser.mjs' : 'scripts/review-183-browser.mjs';", "const browserScript = 'scripts/review-211-browser.mjs';"],
  ["const artifacts = resolve(usageReview ? '.agent-runs/W18-usage-next-step-199' : overviewReview ? '.agent-runs/W18-overview-truth-195' : '.agent-runs/W18R8-browser-183');", "const artifacts = resolve('.agent-runs/W18-permission-recovery-211/browser');"],
  ['`w18r8-183-${process.pid}`', '`w18-permission-211-${process.pid}`'],
  ["['src/modules/budgets/services/client.ts', 'src/modules/pricing/PricingPage.tsx']", "['src/modules/alerts/ChannelSettings.tsx', 'src/modules/waves/page.tsx']"],
  ['/Budgets regression: expected empty state, not a blank page/', '/Permission recovery assertions failed/'],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Review lifecycle changed: ${before}`);
  source = source.replace(before, after);
}
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
