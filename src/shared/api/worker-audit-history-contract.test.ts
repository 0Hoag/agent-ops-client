import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { http } from '../http';
import { api } from './client';

describe('generated worker audit history contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not contain duplicate JSON object keys in the API snapshot', () => {
    const snapshot = readFileSync(fileURLToPath(new URL('./swagger.json', import.meta.url)), 'utf8');
    const duplicateKeys: string[] = [];
    const tokens = snapshot.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,"]+/g) ?? [];
    const objects: Set<string>[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === '{') objects.push(new Set());
      else if (token === '}') objects.pop();
      else if (token.startsWith('"') && tokens[index + 1] === ':' && objects.length > 0) {
        const key = JSON.parse(token) as string;
        const current = objects[objects.length - 1];
        if (current.has(key)) duplicateKeys.push(key);
        current.add(key);
      }
    }

    expect(duplicateKeys).toEqual([]);
  });

  it('requests paginated audit history and preserves the real Go wire fields for the module adapter', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'worker-token' });
    const response = {
      data: {
        data: [{
          Action: 'start',
          ActorID: 'actor-1',
          CreatedAt: '2026-11-02T12:00:00Z',
          ID: 'audit-1',
          JobID: 'job-1',
          OccurredAt: '2026-11-02T11:59:00Z',
          OrganizationID: 'org-1',
          Outcome: 'accepted',
          Wave: 'W14x',
        }],
        meta: { page: 2, per_page: 5, total: 11 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    };
    const request = vi.spyOn(http, 'request').mockResolvedValue({
      ...response,
    } as never);

    const result = await api.api.v1WorkersAuditHistoryList({ page: 2, per_page: 5 });

    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]?.method).toBe('GET');
    expect(request.mock.calls[0][0]?.url).toBe('/api/v1/workers/audit-history?page=2&per_page=5');
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer worker-token');
    expect(result.data).toEqual(response.data);
    expect(result.data.data?.[0]).toMatchObject({
      ID: 'audit-1',
      Action: 'start',
      ActorID: 'actor-1',
      JobID: 'job-1',
      OrganizationID: 'org-1',
      Outcome: 'accepted',
      Wave: 'W14x',
      CreatedAt: '2026-11-02T12:00:00Z',
      OccurredAt: '2026-11-02T11:59:00Z',
    });
    expect(result.data.meta).toEqual({ page: 2, per_page: 5, total: 11 });
  });

  it('asserts the audit route is present in the generated client', () => {
    expect(api.api.v1WorkersAuditHistoryList).toBeTypeOf('function');
  });
});
