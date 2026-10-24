import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ops-env-'));
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = fs.readFileSync(path.join(project, 'rspack.config.ts'), 'utf8');
const consumer = fs.readFileSync(path.join(project, 'src/shared/http.ts'), 'utf8');
const require = createRequire(path.join(project, 'package.json'));
const dotenvPath = require.resolve('dotenv');
const axiosPath = require.resolve('axios');
const envSource = fs.readFileSync(path.join(project, 'src/shared/env.ts'), 'utf8');
const httpSource = fs.readFileSync(path.join(project, 'src/shared/http.ts'), 'utf8');

function runFixture(order) {
  const rootArg = JSON.stringify(root);
  const orderArg = JSON.stringify(order);
  const axiosRequire = JSON.stringify(`require("${axiosPath}")`);
  const source = `
    const fs = require('node:fs');
    const path = require('node:path');
    const dotenv = require(${JSON.stringify(dotenvPath)});
    for (const file of ${orderArg}) dotenv.config({ path: path.join(${rootArg}, file), override: true });
    const compiler = require(${JSON.stringify(require.resolve('typescript'))});
    const env = compiler.transpileModule(${JSON.stringify(envSource)}, { compilerOptions: { module: compiler.ModuleKind.CommonJS } }).outputText.replace('process.env.APP_API_URL', JSON.stringify(process.env.APP_API_URL || ''));
    const http = compiler.transpileModule(${JSON.stringify(httpSource)}, { compilerOptions: { module: compiler.ModuleKind.CommonJS } }).outputText.replace('require("axios")', ${axiosRequire});
    fs.writeFileSync(path.join(${rootArg}, 'env.js'), env);
    fs.writeFileSync(path.join(${rootArg}, 'http.js'), http);
    console.log(require(path.join(${rootArg}, 'http.js')).http.defaults.baseURL);
  `;
  const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8' });
  return result;
}

try {
  fs.writeFileSync(path.join(root, '.env'), 'APP_API_URL=https://base.example\n');
  fs.writeFileSync(path.join(root, '.env.test'), 'APP_API_URL=https://mode.example\n');
  fs.writeFileSync(path.join(root, '.env.local'), 'APP_API_URL=https://local.example\n');

  assert.match(config, /\.env', `\.env\.\$\{mode\}`, '\.env\.local'/);
  assert.match(config, /process\.env\.APP_API_URL/);
  assert.match(consumer, /axios\.create\(\{ baseURL: getApiBaseUrl\(\) \}\)/);

  const expectedOrder = runFixture(['.env', '.env.test', '.env.local']);
  assert.equal(expectedOrder.status, 0, expectedOrder.stderr);
  assert.equal(expectedOrder.stdout.trim(), 'https://local.example');

  const wrongOrder = runFixture(['.env.local', '.env.test', '.env']);
  assert.notEqual(wrongOrder.stdout.trim(), 'https://local.example', 'wrong-precedence control unexpectedly passed');
  assert.throws(() => assert.equal(wrongOrder.stdout.trim(), 'https://local.example'), {
    message: /Expected values to be strictly equal/,
  });
  console.log(`env precedence PASS: consumer received ${expectedOrder.stdout.trim()}`);
  console.log(`wrong-order control diagnostic: ${wrongOrder.stdout.trim()} !== https://local.example`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
