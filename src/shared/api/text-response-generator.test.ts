import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';

const execFileAsync = promisify(execFile);
const templateDirectory = join(process.cwd(), 'scripts/api-templates');

describe('text/plain Swagger generation', () => {
  it('generates a text decoder and returns Prometheus content through the shared transport', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'metrics-generator-'));

    try {
      const schemaPath = join(directory, 'swagger.json');
      const outputDirectory = join(directory, 'generated');
      await writeFile(schemaPath, JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Metrics fixture', version: '1.0.0' },
        paths: {
          '/metrics': {
            get: {
              operationId: 'getMetrics',
              responses: {
                '200': {
                  description: 'Prometheus metrics',
                  content: { 'text/plain': { schema: { type: 'string' } } },
                },
              },
            },
          },
        },
      }));

      await execFileAsync(join(process.cwd(), 'node_modules/.bin/swagger-typescript-api'), [
        'generate', '-p', schemaPath, '-o', outputDirectory, '-n', 'Api.ts',
        '--axios', '--templates', templateDirectory, '--single-http-client',
      ]);

      const generated = await readFile(join(outputDirectory, 'Api.ts'), 'utf8');
      expect(generated).toMatch(/getMetrics:[\s\S]*?format: "text"/);
      expect(generated).toMatch(/getMetrics:[\s\S]*?Accept: "text\/plain"/);

      const { Api, HttpClient } = await import(`${outputDirectory}/Api.ts`);
      const request = vi.fn().mockResolvedValue({
        data: 'agent_ops_up 1\n', status: 200, statusText: 'OK', headers: {}, config: { headers: {} },
      });
      const instance = Object.assign(axios.create(), { request });
      const api = new Api(new HttpClient({ instance }));
      const response = await api.metrics.getMetrics();

      expect(request).toHaveBeenCalledWith(expect.objectContaining({
        url: '/metrics', responseType: 'text',
      }));
      expect(response.data).toBe('agent_ops_up 1\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
