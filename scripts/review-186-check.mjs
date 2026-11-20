// Checks measured cells, not setup. Optional page/fault filters reproduce a defect.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [file, page, fault] = process.argv.slice(2);
const { discovery, matrix } = JSON.parse(readFileSync(file, 'utf8'));
const rows = matrix.filter((row) => (!page || row.name === page) && (!fault || row.fault === fault));
assert(rows.length, 'No measured cells match the filters');
const failures = [];
for (const row of rows) {
  const label = `${row.name} ${row.call} ${row.fault}`;
  if (row.harnessError || !row.hits) failures.push(`${label}: UNVERIFIED ${row.harnessError ?? 'call not reached'}`);
  else if (row.assessment?.startsWith('DEFECT')) failures.push(`${label}: ${row.assessment}`);
  else if (row.retryRecovered === false) failures.push(`${label}: Retry did not recover`);
}
if (!page && discovery.some((row) => row.setupError)) failures.push('Discovery contains unverified pages');
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`PASS ${rows.length} measured cells: no detected defects. REVIEW/OBSERVED cells still need contextual inspection; this is not blanket acceptance.`);
