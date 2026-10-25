import { useQuery } from '@tanstack/react-query';
import { insightsApi } from './client';
import type { InsightsResponse, RepositoryPage } from './types';

export async function getRepositories(): Promise<RepositoryPage> {
  return (await insightsApi.get<RepositoryPage>('/api/v1/repositories', { params: { page: 1, per_page: 100 } })).data;
}

export async function getInsights(repositoryId: string): Promise<InsightsResponse> {
  return (await insightsApi.get<{ data: InsightsResponse }>('/api/v1/insights', { params: { repository_id: repositoryId } })).data.data;
}

export function useRepositories() {
  return useQuery({ queryKey: ['insights', 'repositories'], queryFn: getRepositories });
}

export function useInsights(repositoryId: string) {
  return useQuery({ queryKey: ['insights', repositoryId], queryFn: () => getInsights(repositoryId), enabled: Boolean(repositoryId) });
}

export function formatPercent(rate: number, denominator: number, complete: boolean): string {
  if (!complete) return 'Unknown — incomplete history';
  if (denominator === 0) return 'N/A — no eligible records';
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatCycleTime(completed: number, seconds: number, complete: boolean): string {
  if (!complete) return 'Unknown — incomplete history';
  if (completed === 0) return 'N/A — no completed issues';
  const days = seconds / 86400;
  return `${days.toFixed(1)} days`;
}
