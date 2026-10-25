import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import type { AgentrunAgentRun, AgentrunAggregate } from '../../../shared/api/generated/Api';

export interface RunFilters { repository_id?: string; wave?: string; issue_number?: number }
type Run = AgentrunAgentRun;
type RunAggregate = AgentrunAggregate;

export async function getRuns(filters: RunFilters = {}): Promise<Run[]> {
  return (await api.api.v1AgentRunsList(filters)).data.data ?? [];
}

export async function getRunAggregates(filters: Pick<RunFilters, 'repository_id' | 'wave'> = {}): Promise<RunAggregate[]> {
  return (await api.api.v1AgentRunsAggregateList(filters)).data.data ?? [];
}

export function cacheHitPercent(aggregate: Pick<RunAggregate, 'input_tokens' | 'cached_input_tokens' | 'cache_write_tokens'>): number | null {
  const input = aggregate.input_tokens ?? 0;
  const cached = aggregate.cached_input_tokens ?? 0;
  const written = aggregate.cache_write_tokens ?? 0;
  const total = input + cached + written;
  return total === 0 ? null : (cached / total) * 100;
}

export function useRuns(filters: RunFilters = {}) {
  return useQuery({ queryKey: ['runs', filters], queryFn: () => getRuns(filters) });
}

export function useRunAggregates(filters: Pick<RunFilters, 'repository_id' | 'wave'> = {}) {
  return useQuery({ queryKey: ['runs', 'aggregate', filters], queryFn: () => getRunAggregates(filters) });
}
