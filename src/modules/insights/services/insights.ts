import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import type { InsightsResponse, Repository, RepositoryPage } from './types';

export async function getRepositories(): Promise<RepositoryPage> {
  const response = await api.api.v1RepositoriesList();
  return (response.data.data ?? []).filter((repository): repository is Repository => Boolean(repository.id));
}

export async function getInsights(repositoryId: string): Promise<InsightsResponse> {
  return (await api.api.v1InsightsList({ repository_id: repositoryId })).data.data! as InsightsResponse;
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
