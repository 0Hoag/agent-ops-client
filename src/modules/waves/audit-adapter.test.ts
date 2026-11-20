import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { http } from '../../shared/http';
import { listWorkerAuditHistory } from './service';

const captured = JSON.parse(readFileSync(new URL('./fixtures/worker-audit-history.json', import.meta.url), 'utf8')) as {
  data: { ID: string; OrganizationID: string; ActorID: string; OccurredAt: string; CreatedAt: string; Action: string; Wave: string; JobID: string; Outcome: string }[];
  meta: { page: number; per_page: number; total: number };
};

describe('worker audit API adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retains accepted-start evidence from the captured isolated production response', async () => {
    vi.spyOn(http, 'request').mockResolvedValue({ data: captured } as never);
    const result = await listWorkerAuditHistory(1, 10);
    const row = captured.data[0];
    expect(result).toEqual({ data: [{ id: row.ID, organizationID: row.OrganizationID, actorID: row.ActorID, occurredAt: row.OccurredAt, createdAt: row.CreatedAt, action: row.Action, wave: row.Wave, jobID: row.JobID, outcome: row.Outcome }], meta: captured.meta });
  });

  it('normalizes the production Go response without changing pagination or identity', async () => {
    const row = { ID: 'audit-1', OrganizationID: 'org-a', ActorID: 'account-1', OccurredAt: '2026-11-14T03:00:00Z', CreatedAt: '2026-11-14T03:00:01Z', Action: 'start', Wave: 'settings-190', JobID: 'job-1', Outcome: 'accepted' };
    const meta = { page: 2, per_page: 5, total: 11 };
    const request = vi.spyOn(http, 'request').mockResolvedValue({ data: { data: [row], meta } } as never);
    const result = await listWorkerAuditHistory(2, 5);
    expect(request.mock.calls[0][0]?.url).toBe('/api/v1/workers/audit-history?page=2&per_page=5');
    expect(result).toEqual({ data: [{ id: row.ID, organizationID: row.OrganizationID, actorID: row.ActorID, occurredAt: row.OccurredAt, createdAt: row.CreatedAt, action: row.Action, wave: row.Wave, jobID: row.JobID, outcome: row.Outcome }], meta });
  });

  it('preserves documented lower-camel responses and missing fields without inventing evidence', async () => {
    const row = { id: 'documented', actorID: 'Ada', action: 'restart', outcome: 'rejected', createdAt: '2026-11-14T03:00:01Z' };
    vi.spyOn(http, 'request').mockResolvedValue({ data: { data: [row, { ID: 'missing', ActorID: null, OccurredAt: null, Action: null, Wave: null, JobID: null, Outcome: null }] } } as never);
    const result = await listWorkerAuditHistory(1, 10);
    expect(result.data?.[0]).toMatchObject(row);
    expect(result.data?.[1]).toEqual({ id: 'missing', organizationID: undefined, actorID: undefined, occurredAt: undefined, createdAt: undefined, action: undefined, wave: undefined, jobID: undefined, outcome: undefined });
  });
});
