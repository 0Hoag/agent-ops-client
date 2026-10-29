import { describe, expect, it } from 'vitest';
import { cacheHitPercent, getRuns, getRunTimeline } from './runs';
import { api } from '../../../shared/api/client';
import { vi } from 'vitest';

const list = vi.spyOn(api.api, 'v1AgentRunsList');
const timeline = vi.spyOn(api.api, 'v1AgentRunsTimelineList');

describe('cacheHitPercent', () => {
  it('uses normalized cached, input, and cache-write tokens', () => {
    expect(cacheHitPercent({ input_tokens: 30, cached_input_tokens: 50, cache_write_tokens: 20 })).toBe(50);
  });

  it('returns null when the token denominator is zero', () => {
    expect(cacheHitPercent({ input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0 })).toBeNull();
  });
});

describe('run API service', () => {
  it('preserves page data and metadata while sending all filters unchanged', async () => {
    const params = { repository_id: 'r', wave: 'W11', harness: 'h', model: 'm', issue_number: 12, pr_number: 13, started_after: 'a', started_before: 'b', page: 2, per_page: 50 };
    list.mockResolvedValueOnce({ data: { data: [{ id: 'run' }], meta: { page: 2, per_page: 50, total: 101 } } } as never);
    await expect(getRuns(params)).resolves.toEqual({ data: [{ id: 'run' }], meta: { page: 2, per_page: 50, total: 101 } });
    expect(list).toHaveBeenCalledWith(params);
  });

  it('loads and sorts nothing implicitly: exposes ordered steps from the API', async () => {
    timeline.mockResolvedValueOnce({ data: { data: { steps: [{ sequence: 2 }, { sequence: 1 }] } } } as never);
    await expect(getRunTimeline('run-1')).resolves.toEqual([{ sequence: 2 }, { sequence: 1 }]);
    expect(timeline).toHaveBeenCalledWith('run-1');
  });
});
