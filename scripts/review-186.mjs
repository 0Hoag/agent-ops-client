// Reuse the persisted fixture without changing consumers of the #183 lifecycle.
// Run: /Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-186.mjs
import { readFileSync } from 'node:fs';

let source = readFileSync(new URL('./review-183.mjs', import.meta.url), 'utf8');
const replacements = [
  ["const browserScript = overviewReview ? 'scripts/review-195-browser.mjs' : 'scripts/review-183-browser.mjs';", "const browserScript = 'scripts/review-186-browser.mjs';"],
  ["const artifacts = resolve(usageReview ? '.agent-runs/W18-usage-next-step-199' : overviewReview ? '.agent-runs/W18-overview-truth-195' : '.agent-runs/W18R8-browser-183');", "const artifacts = resolve(process.env.REVIEW_AFTER === '1' ? '.agent-runs/W18R11-client-states-186/after' : '.agent-runs/W18R11-client-states-186');"],
  ['`w18r8-183-${process.pid}`', '`w18r11-186-${process.pid}`'],
  ['timeout: 900000', 'timeout: 10800000'],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Review 183 lifecycle changed: ${before}`);
  source = source.replace(before, after);
}
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
