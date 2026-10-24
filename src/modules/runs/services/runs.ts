import { useQuery } from '@tanstack/react-query';
import { runsApi } from './client';
import type { ApiEnvelope, Run, RunAggregate } from './types';

export interface RunFilters { repository_id?: string; wave?: string; issue_number?: number }

export async function getRuns(filters: RunFilters = {}): Promise<Run[]> {
  return (await runsApi.get<ApiEnvelope<Run[]>>('/api/v1/agent-runs', { params: filters })).data.data;
}

export async function getRunAggregates(filters: Pick<RunFilters, 'repository_id' | 'wave'> = {}): Promise<RunAggregate[]> {
  return (await runsApi.get<ApiEnvelope<RunAggregate[]>>('/api/v1/agent-runs/aggregate', { params: filters })).data.data;
}

export function cacheHitPercent(aggregate: Pick<RunAggregate, 'input_tokens' | 'cached_input_tokens' | 'cache_write_tokens'>): number | null {
  const total = aggregate.input_tokens + aggregate.cached_input_tokens + aggregate.cache_write_tokens;
  return total === 0 ? null : (aggregate.cached_input_tokens / total) * 100;
}

export function useRuns(filters: RunFilters = {}) {
  return useQuery({ queryKey: ['runs', filters], queryFn: () => getRuns(filters) });
}

export function useRunAggregates(filters: Pick<RunFilters, 'repository_id' | 'wave'> = {}) {
  return useQuery({ queryKey: ['runs', 'aggregate', filters], queryFn: () => getRunAggregates(filters) });
}
