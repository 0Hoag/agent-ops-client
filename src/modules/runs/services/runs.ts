import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import type { AgentrunAgentRun, AgentrunAggregate, AgentrunRunStep } from '../../../shared/api/generated/Api';

export interface RunFilters { repository_id?: string; wave?: string; harness?: string; model?: string; issue_number?: number; pr_number?: number; started_after?: string; started_before?: string; page?: number; per_page?: number }
type Run = AgentrunAgentRun;
type RunAggregate = AgentrunAggregate;
export interface RunPage { data: Run[]; meta: { page: number; per_page: number; total: number } }
export type RunStep = AgentrunRunStep;

export async function getRuns(filters: RunFilters = {}): Promise<RunPage> {
  const response = (await api.api.v1AgentRunsList({ page: 1, per_page: 20, ...filters })).data;
  return { data: response.data ?? [], meta: { page: response.meta?.page ?? filters.page ?? 1, per_page: response.meta?.per_page ?? filters.per_page ?? 20, total: response.meta?.total ?? 0 } };
}

export async function getRunTimeline(runId: string): Promise<RunStep[]> {
  const response = (await api.api.v1AgentRunsTimelineList(runId)).data;
  const payload = response as unknown as { data?: { steps?: RunStep[] } | RunStep[]; steps?: RunStep[] };
  return Array.isArray(payload.data) ? payload.data : payload.data?.steps ?? payload.steps ?? [];
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

export function useRunTimeline(runId: string) {
  return useQuery({ queryKey: ['runs', runId, 'timeline'], queryFn: () => getRunTimeline(runId), enabled: Boolean(runId) });
}

export function useRunAggregates(filters: Pick<RunFilters, 'repository_id' | 'wave'> = {}) {
  return useQuery({ queryKey: ['runs', 'aggregate', filters], queryFn: () => getRunAggregates(filters) });
}
