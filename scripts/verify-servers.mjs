import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const project = process.cwd();

async function verify(script, port, expectedText) {
  const server = spawn('pnpm', [script, '--host', '127.0.0.1', '--port', String(port)], {
    cwd: project,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => { output += chunk.toString(); });
  server.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const url = `http://127.0.0.1:${port}/`;
  let response;
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`${script} exited early: ${output}`);
      try {
        response = await fetch(url);
        if (response.ok) break;
      } catch {}
      await delay(500);
    }
    assert.equal(response?.status, 200, `${script} readiness timeout; output: ${output}`);
    const html = await response.text();
    assert.match(html, new RegExp(expectedText));
    console.log(`${script} ${url} HTTP ${response.status}; ready; expected HTML marker found`);
  } finally {
    if (server.pid && server.exitCode === null) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch {}
      await Promise.race([
        new Promise((resolve) => server.once('exit', resolve)),
        delay(5000),
      ]);
      try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
    }
    if (server.pid) {
      try { process.kill(-server.pid, 0); throw new Error(`process group ${server.pid} survived cleanup`); } catch (error) {
        if (error instanceof Error && error.message.includes('survived')) throw error;
      }
      console.log(`${script} process group ${server.pid} cleanup verified`);
    }
  }
}

await verify('dev', 4317, 'Agent Ops');
await verify('preview', 4318, 'Agent Ops');
