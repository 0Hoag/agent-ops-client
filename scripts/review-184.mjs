// Reuse #183's real bootstrap, seeded login, Compose lifecycle and cleanup.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function reviewNumbers({ env, artifacts, run, compose, composeArgs, root }) {
  env.W18_NOW = new Date().toISOString();
  writeFileSync(`${artifacts}/numeric-inputs.json`, JSON.stringify({ now: env.W18_NOW, run: env.W18_RUN, repository: env.W18_REPOSITORY, url: env.PRODUCT_E2E_URL }, null, 2));
  // Persist recorded telemetry, not a response override. Include null, zero,
  // small and large recorded costs independently of calculated model pricing.
  const fixtureSQL = `UPDATE agent_runs SET cost_usd = CASE
    WHEN model = 'review-unpriced' THEN NULL
    WHEN branch = 'feat/hosting-0' THEN 12.4
    WHEN branch = 'feat/hosting-1' THEN 0
    WHEN branch = 'feat/hosting-2' THEN 0.0001
    WHEN branch = 'feat/hosting-3' THEN 1234567.89 ELSE 1 END;
    UPDATE agent_runs SET input_tokens = 0, cached_input_tokens = 0,
      cache_write_tokens = 0, output_tokens = 0, reasoning_tokens = 0
      WHERE branch = 'feat/hosting-1';
    UPDATE agent_runs SET cost_usd = CASE branch
      WHEN 'feat/hosting-1' THEN 0 WHEN 'feat/hosting-2' THEN 0.0002 ELSE 5 END
      WHERE model = 'review-unpriced' AND branch IN ('feat/hosting-1', 'feat/hosting-2', 'feat/hosting-3');
    UPDATE agent_runs SET harness = 'Codex'
      WHERE model = 'review-priced' AND branch = 'feat/hosting-3';
    UPDATE agent_runs SET session_id = 'review-multi-run'
      WHERE model = 'review-priced' AND branch IN ('feat/hosting-2', 'feat/hosting-3');
    INSERT INTO agent_run_steps (id, run_id, sequence, started_at, input_tokens, tool_name, cache_hit)
    SELECT gen_random_uuid(), r.id, n, NOW() - INTERVAL '2 hours',
      CASE n WHEN 1 THEN 0 WHEN 2 THEN 100 WHEN 3 THEN 1000 ELSE 10 END,
      'Read', CASE n WHEN 1 THEN false WHEN 3 THEN false ELSE true END
    FROM agent_runs r CROSS JOIN generate_series(1, 4) n
    WHERE r.model = 'review-priced' AND r.branch = 'feat/hosting-2';`;
  writeFileSync(`${artifacts}/numeric-fixture.sql`, fixtureSQL);
  run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: fixtureSQL });
  const priceTables = run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-At', '-c', "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%price%' ORDER BY tablename"]).split('\n').filter(Boolean);
  assert(priceTables.length, 'Persisted price tables must exist');
  const priceSQL = priceTables.map((name) => `(SELECT COALESCE(json_agg(p), '[]'::json) FROM "${name.replaceAll('"', '""')}" p)`).join(',');
  const sql = `SELECT json_build_object(
    'prices', json_build_array(${priceSQL}),
    'runs', (SELECT json_agg(r) FROM agent_runs r),
    'steps', (SELECT json_agg(s) FROM agent_run_steps s),
    'step_priced_usd', (SELECT SUM(input_tokens * 3 + cached_input_tokens * 0.3 +
      cache_write_tokens * 3.75 + output_tokens * 15 + reasoning_tokens * 15) / 1000000
      FROM agent_run_steps WHERE run_id = '${env.W18_RUN}'),
    'prs', (SELECT json_agg(p) FROM pull_requests p),
    'pipelines', (SELECT json_agg(p) FROM pipeline_runs p),
    'issues', (SELECT json_agg(i) FROM issues i)
  );`;
  writeFileSync(`${artifacts}/oracle.sql`, sql);
  const snapshot = run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  JSON.parse(snapshot);
  writeFileSync(`${artifacts}/sql.json`, snapshot);
  env.W18_SQL = `${artifacts}/sql.json`;
  // A genuine formatter defect in a disposable worktree, never changed inputs.
  const control = resolve(artifacts, 'control-source');
  run('git', ['worktree', 'add', '--detach', control, 'HEAD']);
  try {
    for (const path of run('git', ['ls-files', '-z']).split('\0').filter(Boolean)) {
      cpSync(`${root}/${path}`, `${control}/${path}`, { recursive: true });
    }
    const path = `${control}/src/shared/format.ts`;
    const original = readFileSync(path, 'utf8');
    assert(original.includes('.format(value);'));
    writeFileSync(path, original.replace('.format(value);', '.format(value * 2);'));
    env.CLIENT_DIR = control;
    compose('up', '-d', '--build', '--wait', 'client');
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/control`;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    const output = run('node', ['scripts/review-184-browser.mjs'], { expectedStatus: 1 });
    assert.match(output, /Session headline recorded cost/);
    writeFileSync(`${artifacts}/control-result.txt`, output);
  } finally {
    env.CLIENT_DIR = root;
    env.PRODUCT_E2E_ARTIFACTS = artifacts;
    compose('up', '-d', '--build', '--wait', 'client');
    run('git', ['worktree', 'remove', '--force', control]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.argv.push('--numbers-184');
  void import('./review-183.mjs');
}
