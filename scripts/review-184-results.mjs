import assert from 'node:assert/strict';

// A mismatch is retained, not accepted. Navigation failures can be isolated by
// family, while every independent figure comparison still reaches finish().
export function results() {
  const failures = [];
  const comparisons = [];
  function check(name, expected, actual) {
    const entry = { name, expected, actual, pass: true };
    try { assert.deepEqual(actual, expected); }
    catch { entry.pass = false; failures.push({ name, expected, actual }); }
    comparisons.push(entry);
  }
  async function family(name, action) {
    try { await action(); }
    catch (error) { failures.push({ name, error: error.stack || String(error) }); }
  }
  function finish() {
    if (failures.length) throw new Error(`Numeric matrix failed (${failures.length}):\n${failures.map((failure) => JSON.stringify(failure)).join('\n')}`);
  }
  return { failures, comparisons, check, family, finish };
}
