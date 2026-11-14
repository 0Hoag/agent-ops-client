import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Extend the committed isolated-stack lifecycle; never touch another project's data. */
export async function reviewPages({ root, artifacts, env, request, token, run, composeArgs, compose }) {
  const repo = (await request('repositories', { provider: 'gitlab', full_name: 'w19/pages', gitlab_base_url: 'https://gitlab.example.invalid', webhook_secret: 'synthetic-pages-webhook-secret' }, token)).data;
  await request('agent-run-prices', { model: 'pages-priced', effective_date: '2020-01-01T00:00:00Z', input_per_million: 2, output_per_million: 10, cached_input_per_million: 0.2, cache_write_per_million: 2, reasoning_per_million: 10 }, token);
  const started = new Date(Date.now() - 3600000).toISOString();
  const fixture = { repository: repo.id, started, limits: 'One priced model, one tool, one GitLab repository; not complete cost acceptance. Separate strict #557/#559 probes remain blocking.' };
  for (const number of [1, 2]) {
    const row = (await request('agent-runs', { repository_id: repo.id, model: 'pages-priced', harness: 'Claude', branch: `feat/pages-${number}`, session_id: `pages-session-${number}`, pr_number: number, issue_numbers: [number], started_at: started, ended_at: new Date().toISOString(), input_tokens: 1000000, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, reasoning_tokens: 0 }, token)).data;
    fixture[`run${number}`] = row.id;
  }
  // Both the unaffected $2 case and divergent recorded $12.40 probe are persisted.
  const sql = `
    INSERT INTO pull_requests (id, repository_id, number, title, state, head_sha, branch, closes, created_at, updated_at)
    SELECT gen_random_uuid(), '${repo.id}', n, 'Pages merge request ' || n,
      CASE WHEN n % 2 = 0 THEN 'closed' ELSE 'open' END, md5(n::text), 'feat/pages-' || n, jsonb_build_array(n), NOW(), NOW()
    FROM generate_series(1, 65) n;
    INSERT INTO issues (id, repository_id, number, title, state, status)
    VALUES (gen_random_uuid(), '${repo.id}', 1, 'Pages linked issue', 'open', 'todo');
    UPDATE agent_runs SET cost_usd = CASE WHEN pr_number = 1 THEN 2 ELSE 12.4 END WHERE repository_id = '${repo.id}';
    INSERT INTO agent_run_steps (id, run_id, sequence, started_at, input_tokens, cached_input_tokens, cache_write_tokens, output_tokens, reasoning_tokens, tool_name, cache_hit, cumulative_cost_usd)
    VALUES (gen_random_uuid(), '${fixture.run1}', 2, NOW(), 600000, 0, 0, 0, 0, 'Test pages', false, 2),
           (gen_random_uuid(), '${fixture.run1}', 1, NOW() - INTERVAL '1 minute', 400000, 0, 0, 0, 0, 'Read pages', true, 0.5);
  `;
  writeFileSync(`${artifacts}/seed.sql`, sql);
  run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: sql });
  const snapshot = run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-At', '-c', `SELECT json_agg(t) FROM (SELECT id, pr_number, issue_numbers, cost_usd, input_tokens FROM agent_runs WHERE repository_id='${repo.id}' ORDER BY pr_number) t`]);
  writeFileSync(`${artifacts}/persisted.json`, snapshot);
  assert.deepEqual(JSON.parse(snapshot).map((row) => Number(row.cost_usd)), [2, 12.4]);
  writeFileSync(`${artifacts}/fixture.json`, JSON.stringify(fixture, null, 2));
  env.PAGES_FIXTURE = `${artifacts}/fixture.json`;
  const browser = (phase) => {
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/${phase}`;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    rmSync(`${env.PRODUCT_E2E_ARTIFACTS}/result.json`, { force: true });
    run('node', ['scripts/verify/pages-browser.mjs'], { allowFailure: true });
    // A crash/auth/environment failure is never a passing acceptance result.
    return JSON.parse(readFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/result.json`, 'utf8'));
  };
  const before = browser('production');
  assert.deepEqual(before.failures.filter((row) => !row.blocked), [], 'Unrelated production assertions must pass');
  const image = run('docker', [...composeArgs, 'images', '-q', 'client']);
  const tag = run('docker', ['image', 'inspect', image, '--format', '{{index .RepoTags 0}}']);
  const source = `${artifacts}/mutation-source`;
  for (const path of run('git', ['ls-files', '-z']).split('\0').filter(Boolean)) {
    mkdirSync(dirname(`${source}/${path}`), { recursive: true });
    cpSync(`${root}/${path}`, `${source}/${path}`);
  }
  const timeline = `${source}/src/modules/sessions/Timeline.tsx`;
  const original = readFileSync(timeline, 'utf8');
  assert(original.includes('Step {step.sequence'));
  writeFileSync(timeline, original.replace('Step {step.sequence', 'Broken {step.sequence'));
  try {
    env.CLIENT_DIR = source;
    compose('up', '-d', '--build', '--wait', 'client');
    const broken = browser('mutation');
    assert(broken.failures.some((row) => row.name === 'PAGE_SESSION_TIMELINE' && !row.blocked), 'Compiled production mutation must fail PAGE_SESSION_TIMELINE');
  } finally {
    env.CLIENT_DIR = root;
    run('docker', ['image', 'tag', image, tag]);
    compose('up', '-d', '--no-build', '--wait', 'client');
  }
  const restored = browser('restored');
  assert.deepEqual(restored.failures.filter((row) => !row.blocked), [], 'Restored production must pass unrelated checks');
  assert.deepEqual(restored.failures.map((row) => row.name), before.failures.map((row) => row.name), 'Identical persisted inputs and restored output');
  assert.equal(restored.failures.length, 0, 'Strict known #557/#559 checks block overall acceptance; never passing exemptions');
}
