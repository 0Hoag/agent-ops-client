import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
mkdirSync('.agent-runs', { recursive: true });
const copy = mkdtempSync(resolve('.agent-runs/auth-mutation-'));
for (const path of ['src', 'package.json', 'vitest.config.ts', 'tsconfig.json']) cpSync(path, resolve(copy, path), { recursive: true });
symlinkSync(resolve('node_modules'), resolve(copy, 'node_modules'), 'dir');
const path = 'src/modules/auth/services/auth.ts';
const test = 'src/modules/auth/services/auth.test.ts';
const original = readFileSync(path);
const testBytes = readFileSync(test);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = () => spawnSync(resolve('node_modules/.bin/vitest'), ['run', test], { cwd: copy, encoding: 'utf8' });
const baseline = run();
assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
let mutated;
try {
  const broken = original.toString().replace('await authClient.api.v1AuthSessionList();', '// Control: skip production post-login session validation.');
  assert.notEqual(broken, original.toString());
  writeFileSync(resolve(copy, path), broken);
  mutated = run();
  assert.notEqual(mutated.status, 0);
  assert.match(mutated.stdout + mutated.stderr, /promise resolved.*instead of rejecting/s);
  assert.match(mutated.stdout + mutated.stderr, /fails if a mutation skips session validation after login/);
} finally {
  writeFileSync(resolve(copy, path), original);
}
const restored = run();
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
assert.deepEqual(readFileSync(resolve(copy, path)), original);
assert.deepEqual(readFileSync(path), original);
assert.deepEqual(readFileSync(resolve(copy, test)), testBytes);
assert.deepEqual(readFileSync(test), testBytes);
mkdirSync('artifacts/auth-session', { recursive: true });
writeFileSync('artifacts/auth-session/mutation.txt', [
  `Disposable copy: ${copy.slice(root.length + 1)}`,
  `Production before/restored/worktree SHA256: ${hash(original)}`,
  `Unchanged test SHA256: ${hash(testBytes)}`,
  `Baseline exit=${baseline.status}\n${baseline.stdout}${baseline.stderr}`,
  `Production mutation exit=${mutated.status}\n${mutated.stdout}${mutated.stderr}`,
  `Byte-identical restore exit=${restored.status}\n${restored.stdout}${restored.stderr}`,
].join('\n').replaceAll(root, '<worktree>').replace(/\x1b\[[0-9;]*m/g, '').replace(/[ \t]+$/gm, '').trimEnd() + '\n');
console.log('PASS: real production validation bypass failed unchanged assertions; byte-identical restore passed.');

const guard = 'src/app/router.tsx';
const guardTest = 'src/app/router.test.tsx';
const guardOriginal = readFileSync(guard);
const guardTestOriginal = readFileSync(guardTest);
const runGuard = () => spawnSync(resolve('node_modules/.bin/vitest'), ['run', guardTest], { cwd: copy, encoding: 'utf8' });
const guardBaseline = runGuard();
assert.equal(guardBaseline.status, 0, guardBaseline.stdout + guardBaseline.stderr);
let guardMutation;
try {
  const broken = guardOriginal.toString().replace('session?.path === location.pathname ? session.valid : null', 'session?.valid ?? null');
  assert.notEqual(broken, guardOriginal.toString());
  writeFileSync(resolve(copy, guard), broken);
  guardMutation = runGuard();
  assert.notEqual(guardMutation.status, 0);
  assert.match(guardMutation.stdout + guardMutation.stderr, /does not render the next protected route using the previous route validation/);
  assert.match(guardMutation.stdout + guardMutation.stderr, /\/api\/v1\/agent-runs\/aggregate/);
} finally {
  writeFileSync(resolve(copy, guard), guardOriginal);
}
const guardRestored = runGuard();
assert.equal(guardRestored.status, 0, guardRestored.stdout + guardRestored.stderr);
assert.deepEqual(readFileSync(resolve(copy, guard)), guardOriginal);
assert.deepEqual(readFileSync(guard), guardOriginal);
assert.deepEqual(readFileSync(resolve(copy, guardTest)), guardTestOriginal);
writeFileSync('artifacts/auth-session/guard-mutation.txt', [
  `Production guard before/restored/worktree SHA256: ${hash(guardOriginal)}`,
  `Unchanged route test SHA256: ${hash(guardTestOriginal)}`,
  `Baseline exit=${guardBaseline.status}\n${guardBaseline.stdout}${guardBaseline.stderr}`,
  `Production mutation exit=${guardMutation.status}\n${guardMutation.stdout}${guardMutation.stderr}`,
  `Byte-identical restore exit=${guardRestored.status}\n${guardRestored.stdout}${guardRestored.stderr}`,
].join('\n').replaceAll(root, '<worktree>').replace(/\x1b\[[0-9;]*m/g, '').replace(/[ \t]+$/gm, '').trimEnd() + '\n');
console.log('PASS: production cross-route validation mutation leaked a protected request; unchanged test failed; byte-identical restore passed.');
