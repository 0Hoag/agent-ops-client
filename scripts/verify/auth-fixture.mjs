import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

/** Seeds synthetic records through real HTTP; SQL supplies upstream-synced issue records. */
export async function seed(env, compose, record) {
  const request = async (path, body, token, expected = 200) => {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    record(`${body ? 'POST' : 'GET'} ${path}: HTTP ${response.status}`);
    assert.equal(response.status, expected, `${path}: unexpected HTTP status${response.status === expected ? '' : ` ${await response.clone().text()}`}`);
    return response.json();
  };
  const credentials = { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD };
  await request('auth/login', { ...credentials, password: 'deliberately-wrong' }, null, 401);
  const login = await request('auth/login', credentials);
  assert.equal((await request('auth/session', null, login.token)).organization_id, undefined);
  const fixtures = [];
  for (const letter of ['A', 'B']) {
    const org = (await request('organizations', { name: `Auth 188 ${letter}` }, login.token, 201)).data;
    const selected = await request('auth/select-organization', { organization_id: org.id }, login.token);
    assert.equal((await request('auth/session', null, selected.token)).organization_id, org.id);
    const repo = (await request('repositories', { provider: 'github', full_name: `auth-188/tenant-${letter.toLowerCase()}`, webhook_secret: randomBytes(24).toString('hex') }, selected.token, 201)).data;
    const run = (await request('agent-runs', { repository_id: repo.id, model: 'auth-fixture', harness: 'Synthetic tool', wave: 'Auth verification', worker: 'Synthetic agent', branch: `auth-${letter}`, session_id: `auth-${letter}`, started_at: new Date(Date.now() - 60000).toISOString(), ended_at: new Date().toISOString(), input_tokens: 100 }, selected.token, 201)).data;
    compose('exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO issues (id, repository_id, number, title, state, status) VALUES (gen_random_uuid(), '${repo.id}', 188, 'Tenant ${letter} private task', 'open', 'todo');`);
    fixtures.push({ org: org.id, repo: repo.id, run: run.id, name: org.name, repository: repo.full_name, task: `Tenant ${letter} private task` });
  }
  for (let i = 0; i < fixtures.length; i++) {
    const selected = await request('auth/select-organization', { organization_id: fixtures[i].org }, login.token);
    const repos = (await request('repositories', null, selected.token)).data;
    assert.deepEqual(repos.map((repo) => repo.id), [fixtures[i].repo]);
    await request(`repositories/${fixtures[1 - i].repo}`, null, selected.token, 404);
  }
  record('PASS real HTTP login, unscoped/scoped sessions and cross-tenant repository isolation');
  env.AUTH_FIXTURE = JSON.stringify(fixtures);
}
