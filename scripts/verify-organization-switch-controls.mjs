import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp('/tmp/organization-switch-controls-');
const files = ['src/shared/http.ts', 'src/modules/auth/services/auth.ts'];
const hashes = new Map();
const sha = (value) => createHash('sha256').update(value).digest('hex');
const runScript = join(temp, 'scripts/verify-organization-switch-browser.mjs');
try {
  for (const file of files) hashes.set(file, sha(await readFile(join(root, file))));
  await cp(root, temp, { recursive: true, filter: (source) => !source.includes('/node_modules') && !source.includes('/.git') && !source.includes('/dist') });
  await run('pnpm', ['install', '--frozen-lockfile'], { cwd: temp });
  await run('pnpm', ['build'], { cwd: temp });
  await run('node', [runScript], { cwd: temp });
  const controls = [
    ['explicit-bearer', files[0], "if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;", "if (token) config.headers.Authorization = `Bearer ${token}`;", /CONTROL ASSERTION: explicit bearer preservation assertion: selected-token validation used the active tenant token/],
    ['switch-cache', files[1], "if (typeof window !== 'undefined') window.dispatchEvent(new Event('organization:will-change'));", '', /CONTROL ASSERTION: stale session\/cache guard removal prevented tenant-B repository state from loading/],
  ];
  for (const [name, file, expected, mutation, behavior] of controls) {
    const sourcePath = join(temp, file);
    const original = await readFile(sourcePath, 'utf8');
    assert(original.includes(expected), `${name}: expected production behavior not found`);
    await writeFile(sourcePath, original.replace(expected, mutation));
    await run('pnpm', ['build'], { cwd: temp });
    await run('pnpm', ['build'], { cwd: temp });
    const control = await run('node', [runScript], { cwd: temp }).then(() => ({ failed: false, output: '' }), (error) => ({ failed: true, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }));
    assert(control.failed, `${name}: browser assertions unexpectedly passed with the production behavior removed`);
    assert(behavior.test(control.output), `${name}: failure did not report intended behavioral diagnostic: ${control.output}`);
    console.log(`CONTROL FAIL AS EXPECTED: ${name}: ${control.output.split('\n').find((line) => behavior.test(line))}`);
    await writeFile(sourcePath, original);
    await run('pnpm', ['build'], { cwd: temp });
    await run('node', [runScript], { cwd: temp });
    assert.equal(sha(await readFile(sourcePath)), sha(original), `${name}: disposable source restoration hash mismatch`);
    console.log(`RESTORATION PASS: ${name} rebuilt and baseline browser assertions pass`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
  for (const [file, hash] of hashes) assert.equal(sha(await readFile(join(root, file))), hash, `working tree source changed: ${file}`);
  console.log('RESTORE PASS: disposable production copy removed; working tree source hashes unchanged');
}
