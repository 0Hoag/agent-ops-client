import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const snapshot = readFileSync(new URL('./swagger.json', import.meta.url));
const provenance = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');
const generatorHash = provenance.match(/api\/docs\/swagger\.json`, SHA-256 `([a-f0-9]{64})`/)?.[1];
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('Swagger generator byte contract', () => {
  it('matches the actual generator output hash recorded in provenance', () => {
    expect(generatorHash).toBeDefined();
    expect(sha256(snapshot)).toBe(generatorHash);
  });

  it('rejects the trailing-newline drift even though JSON is unchanged', () => {
    const drifted = Buffer.concat([snapshot, Buffer.from('\n')]);
    expect(JSON.parse(drifted.toString())).toEqual(JSON.parse(snapshot.toString()));
    expect(sha256(drifted)).not.toBe(generatorHash);
  });
});
