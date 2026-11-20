import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Extends the merged auth lifecycle with explicit local provider/worker boundaries. */
export async function settingsProfile({ env, dir, port, composeArgs, compose, record, run }) {
  const providerPort = await port();
  const provider = spawn(process.execPath, ['scripts/verify/settings-provider.mjs', providerPort, `${dir}/provider.log`], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  await new Promise((done, reject) => { provider.once('message', done); provider.once('error', reject); provider.once('exit', (code) => reject(new Error(`Provider exited ${code}`))); });
  env.SETTINGS_PROVIDER = `http://host.docker.internal:${providerPort}`;
  writeFileSync(`${dir}/worker.sh`, '#!/bin/sh\nset -eu\nprintf "settings-worker-start:%s\\n" "$1"\nsleep 2\nprintf "settings-worker-finish:%s\\n" "$1"\n');
  chmodSync(`${dir}/worker.sh`, 0o755);
  writeFileSync(`${dir}/brief.md`, 'Synthetic worker fixture: emit two deterministic log lines; no external agent.\n');
  const override = `${dir}/settings.compose.json`;
  writeFileSync(override, JSON.stringify({ services: { api: { environment: { WORKER_SCRIPT_ROOTS: '/fixtures', WORKER_WORKTREE_ROOTS: '/fixtures', WORKER_SCRIPTS_JSON: JSON.stringify({ 'settings-fixture': '/fixtures/worker.sh' }) }, volumes: [`${dir}:/fixtures:ro`] } } }, null, 2));
  run('jq', ['empty', override]);
  run('bash', ['-n', `${dir}/worker.sh`]);
  composeArgs.push('-f', override);
  let snapshot;
  return {
    async close() {
      if (provider.exitCode === null && provider.signalCode === null) {
        await new Promise((done) => { provider.once('exit', done); provider.kill('SIGTERM'); });
      }
      record(`PASS cleanup local provider pid=${provider.pid}: exited; zero owned provider processes`);
    },
    async seed() {
      const credentials = { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD };
      const request = async (path, body, token, status = 200) => {
        const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN, Authorization: `Bearer ${token ?? ''}` }, body: JSON.stringify(body) });
        assert.equal(response.status, status, `SETTINGS_FIXTURE_${path}: ${await response.clone().text()}`);
        return response.json();
      };
      const login = await request('auth/login', credentials);
      env.SETTINGS_GUEST_EMAIL = 'settings-invitee@example.invalid';
      run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.SETTINGS_GUEST_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
      const guestLogin = await request('auth/login', { ...credentials, email: env.SETTINGS_GUEST_EMAIL });
      const guestOrg = await request('organizations', { name: 'Settings invitee home' }, guestLogin.token, 201);
      env.SETTINGS_GUEST_ORG = guestOrg.data.id;
      const org = JSON.parse(env.AUTH_FIXTURE)[0];
      const selected = await request('auth/select-organization', { organization_id: org.org }, login.token);
      const pricingRepo = await request('repositories', { provider: 'github', full_name: 'settings-190/pricing', webhook_secret: 'settings-pricing-synthetic-secret' }, selected.token, 201);
      const runRecord = await request('agent-runs', { repository_id: pricingRepo.data.id, model: 'settings-priced', harness: 'Synthetic metered tool', wave: 'settings-price', worker: 'settings-agent', branch: 'settings-price', session_id: 'settings-price', started_at: new Date(Date.now() - 60000).toISOString(), ended_at: new Date().toISOString(), input_tokens: 1000000, output_tokens: 100000 }, selected.token, 201);
      // Independent integer oracle: (1,000,000 * $2 + 100,000 * $5) / 1,000,000 = $2.50.
      env.SETTINGS_FIXTURE = JSON.stringify({ ...org, run: runRecord.data.id, priceRepo: pricingRepo.data.id });
      snapshot = compose('exec', '-T', 'postgres', 'pg_dump', '-U', 'agent_ops', '-d', 'agent_ops', '--clean', '--if-exists').output;
      writeFileSync(`${dir}/snapshot.sha256`, createHash('sha256').update(snapshot).digest('hex'));
      record('PASS persisted synthetic pricing fixture; snapshot reset before every identical-input browser phase');
    },
    reset() {
      // Restore identical IDs, tokens, timestamps and pre-price state, not merely equivalent new records.
      run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: snapshot });
      const output = compose('exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-Atc', "SELECT input_tokens || ',' || output_tokens FROM agent_runs WHERE model='settings-priced'").output.trim();
      assert.equal(output, '1000000,100000', 'SETTINGS_PERSISTED_TOKEN_ORACLE');
      record(`PASS SETTINGS_IDENTICAL_SNAPSHOT ${createHash('sha256').update(snapshot).digest('hex')}`);
    },
    verify() {
      const sql = "SELECT json_build_object('price', (SELECT input_per_million*1 + output_per_million/10 FROM agent_run_price_versions WHERE model='settings-priced'), 'synced', (SELECT count(*) FROM issues WHERE title='Settings synced task'), 'budget', (SELECT count(*) FROM budgets WHERE token_limit=2000000 AND usd_limit=25), 'member', (SELECT count(*) FROM organization_memberships m JOIN accounts a ON a.id=m.account_id WHERE a.email='settings-invitee@example.invalid' AND m.role='viewer'))";
      const actual = JSON.parse(compose('exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-Atc', sql).output);
      writeFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/persisted.json`, JSON.stringify(actual, null, 2));
      assert.deepEqual(actual, { price: 2.5, synced: 1, budget: 1, member: 1 }, 'SETTINGS_INDEPENDENT_PERSISTED_STATE');
      const log = readFileSync(`${dir}/provider.log`, 'utf8');
      for (const path of ['connected:', 'connected/issues?', 'connected/merge_requests?', 'connected/pipelines?']) assert(log.includes(path), `SETTINGS_PROVIDER_HTTP_${path}`);
      record('PASS SETTINGS_INDEPENDENT_PERSISTED_STATE: SQL price=2.5; synced issue=1; budget=1; invited viewer=1; real provider HTTP log');
    },
  };
}
