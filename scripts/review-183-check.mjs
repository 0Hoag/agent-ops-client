// Assertions over captured real-browser/API evidence, not generated route fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [directory = '.agent-runs/W18R8-browser-183/after', rule = 'work-detail'] = process.argv.slice(2);
const matrix = JSON.parse(readFileSync(`${directory}/matrix.json`, 'utf8'));
const responses = JSON.parse(readFileSync(`${directory}/api-responses.json`, 'utf8'));
const row = (name) => matrix.find((item) => item.name === name && item.theme === 'light' && item.width === 390);
if (rule === 'work-detail') {
  const response = responses.find((item) => new URL(item.url).pathname.endsWith('/work/pr/1'));
  assert.equal(JSON.parse(response.body).item.number, 1, 'Work detail requested MR #1 must identify MR #1');
} else if (rule === 'advanced-links') {
  assert.notEqual(row('advanced-agents').resolvedPath, '/work', 'Advanced Agents must not open the ordinary Work list');
  assert.notEqual(row('advanced-logs').resolvedPath, '/usage', 'Advanced Logs must not open Usage');
} else if (rule === 'budget-id-filter') {
  assert.doesNotMatch(row('advanced-budgets').text, /Repository ID/, 'Budget repository selector must not require a raw ID');
} else if (rule === 'setup-command') {
  assert.doesNotMatch(row('settings-agent').text, /--token •/, 'Copied setup command must not contain a masked nonfunctional token');
} else if (rule === 'partial-spend') {
  const response = responses.find((item) => new URL(item.url).pathname.endsWith('/overview'));
  const overview = JSON.parse(response.body).data;
  assert(overview.current.models_without_price.length > 0, 'Review requires an unpriced model');
  assert.match(row('overview').text.split('Getting started')[0], /partial|incomplete|excludes|at least/i, 'Overview spend must disclose missing model prices beside its headline');
} else if (rule === 'usage-next-step') {
  assert.match(row('usage').text, /No priced merge requests/);
  assert.match(row('usage').text, /Set model prices|Configure pricing|Connect sessions/, 'Usage empty ranking needs a contextual next-step action');
} else {
  throw new Error(`Unsupported review rule: ${rule}`);
}
console.log(`PASS ${rule}`);
