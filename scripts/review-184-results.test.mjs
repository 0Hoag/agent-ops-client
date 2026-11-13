import assert from 'node:assert/strict';
import { test } from 'node:test';
import { results } from './review-184-results.mjs';

test('known persisted-linkage discrepancy cannot become success; later figures still execute', async () => {
  const result = results();
  const visited = [];
  await result.family('Work', async () => {
    result.check('Work issue #10 sessions SQL/API', 2, 0);
    visited.push('later Work figure');
  });
  await result.family('Usage', async () => { visited.push('Usage'); });
  assert.deepEqual(visited, ['later Work figure', 'Usage']);
  assert.throws(result.finish, /Work issue #10 sessions SQL\/API.*expected.*2.*actual.*0/);
});

test('family infrastructure errors cannot mask failure or stop unrelated families', async () => {
  const result = results();
  await result.family('Session', async () => { throw new Error('locator unavailable'); });
  await result.family('Overview', async () => { result.check('Overview spend', 1, 2); });
  assert.equal(result.failures.length, 2);
  assert.throws(result.finish, /locator unavailable/);
  assert.throws(result.finish, /Overview spend/);
});
