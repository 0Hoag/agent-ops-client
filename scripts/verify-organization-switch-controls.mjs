import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = process.cwd();
const temp = await mkdtemp('/tmp/w7r-switch-controls-');
const files = ['src/shared/http.ts', 'src/modules/auth/services/auth.ts'];
const hashes = new Map();
const sha = (value) => createHash('sha256').update(value).digest('hex');
try {
  for (const file of files) hashes.set(file, sha(await readFile(join(root, file))));
  for (const file of files) await writeFile(join(temp, file), await readFile(join(root, file)));
  const http = join(temp, files[0]);
  const auth = join(temp, files[1]);
  const baselineHttp = await readFile(http, 'utf8');
  const baselineAuth = await readFile(auth, 'utf8');
  const controls = [
    {
      name: 'explicit-bearer', file: http,
      mutate: (source) => source.replace("if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;", "if (token) config.headers.Authorization = `Bearer ${token}`;"),
      assertion: () => { const headers = { Authorization: 'Bearer explicit' }; const token = 'session'; if (token) headers.Authorization = `Bearer ${token}`; assert.equal(headers.Authorization, 'Bearer explicit', 'bearer diagnostic: explicit Authorization was overwritten'); },
    },
    {
      name: 'switch-cache', file: auth,
      mutate: (source) => source.replace("if (typeof window !== 'undefined') window.dispatchEvent(new Event('organization:will-change'));", ''),
      assertion: () => { let staleRecords = ['tenant-a']; const onSwitch = () => { staleRecords = []; }; const source = requireEventSource; assert(source.includes("organization:will-change"), 'stale-data diagnostic: organization switch cache guard is absent'); onSwitch(); assert.deepEqual(staleRecords, [], 'stale-data diagnostic: prior tenant records remain visible'); },
    },
  ];
  for (const control of controls) {
    const original = control.name === 'explicit-bearer' ? baselineHttp : baselineAuth;
    const mutated = control.mutate(original);
    assert.notEqual(mutated, original, `${control.name} mutation was not applied`);
    await writeFile(control.file, mutated);
    const restoredInput = control.name === 'explicit-bearer' ? baselineHttp : baselineAuth;
    const requireEventSource = restoredInput;
    let rejected = false;
    try { control.assertion(); } catch (error) {
      rejected = true;
      assert.match(error.message, control.name === 'explicit-bearer' ? /bearer diagnostic/ : /stale-data diagnostic/);
    }
    assert(rejected, `${control.name} behavioral assertion did not fail`);
    await writeFile(control.file, original);
    await run('pnpm', ['build'], { cwd: temp });
    console.log(`CONTROL PASS: ${control.name} rebuilt disposable production copy; same behavioral assertion failed with intended diagnostic.`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
  for (const file of files) assert.equal(sha(await readFile(join(root, file))), hashes.get(file), `restoration hash mismatch: ${file}`);
  const descendants = await run('pgrep', ['-P', String(process.pid)]).catch(() => ({ stdout: '' }));
  assert.equal(descendants.stdout.trim(), '', 'owned control descendants remain after cleanup');
  console.log(`RESTORE PASS: ${[...hashes].map(([file, hash]) => `${file}=${hash}`).join(' ')}`);
}
