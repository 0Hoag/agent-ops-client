import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, emptyLists } from './review-186-helpers.mjs';

const row = { hits: 1, errors: [], fault: '500', result: { text: 'Unable to load. Try again.', alerts: ['Unable to load. Try again.'], actions: ['Retry'], loading: [] } };
test('fault oracle rejects blank content, missing retry, crashes and endless loading', () => {
  assert.match(classify(row), /^OBSERVED/);
  for (const changed of [{ text: '' }, { actions: [] }, { loading: ['Loading'] }]) {
    assert.match(classify({ ...row, result: { ...row.result, ...changed } }), /^DEFECT/);
  }
  assert.match(classify({ ...row, errors: ['Render crashed'] }), /^DEFECT/);
  assert.match(classify({ ...row, hits: 0 }), /^UNVERIFIED/);
});
test('session return is asserted rather than inferred from sign-in', () => {
  assert.match(classify({ ...row, fault: '401', sessionReturnPass: false }), /^DEFECT/);
  assert.match(classify({ ...row, fault: '401', sessionReturnPass: true }), /^PASS/);
});
test('shell feedback is observed separately and still needs an actual retry action', () => {
  const result = { text: 'Page content', alerts: [], actions: [], loading: [], shellAlerts: ['Unable to load organization. Try again.'], shellActions: ['Retry'] };
  assert.match(classify({ ...row, result }), /^OBSERVED/);
  assert.match(classify({ ...row, result: { ...result, shellActions: [] } }), /^DEFECT/);
});
test('empty injection preserves envelope and empties only arrays, never claims scalar emptiness', () => {
  assert.deepEqual(JSON.parse(emptyLists('{"data":[1],"meta":{"total":1},"nested":{"rows":[2]}}')), { data: [], meta: { total: 1 }, nested: { rows: [] } });
  assert.match(classify({ ...row, fault: 'empty' }), /^REVIEW/);
});
