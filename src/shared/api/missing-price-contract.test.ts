import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';
import swagger from './swagger.json';

describe('generated missing-price contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('publishes the authenticated missing-price endpoint in the snapshot', () => {
    expect(swagger.paths).toHaveProperty('/api/v1/agent-run-prices/missing', {
      get: {
        security: [{ BearerAuth: [] }],
        produces: ['application/json'],
        summary: 'List models missing an effective price',
        responses: {
          '200': {
            description: 'OK',
            schema: { $ref: '#/definitions/response.SuccessResponse' },
          },
        },
      },
    });
  });

  it('requests missing prices and preserves model, runs and tokens in the response envelope', async () => {
    const data = { status: 200, data: [{ model: 'unknown-model', runs: 2, tokens: 1234 }] };
    const request = vi.spyOn(http, 'request').mockResolvedValue({
      data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} },
    } as never);

    const response = await api.api.v1AgentRunPricesMissingList();

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/v1/agent-run-prices/missing', method: 'GET', responseType: 'json',
    }));
    expect(response.data.status).toBe(200);
    expect(response.data.data).toEqual([{ model: 'unknown-model', runs: 2, tokens: 1234 }]);
  });
});
