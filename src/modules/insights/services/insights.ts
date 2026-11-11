import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/client';
import type { InsightsResponse, Repository, RepositoryPage } from './types';
import type { InsightAnalyticsResponse, InsightDeliveryResponse } from '../../../shared/api/generated/Api';

export type AnalyticsFilters = { repository_id?: string; from: string; to: string; period: 'daily' | 'weekly'; group_by: 'harness' | 'model' | 'wave' | 'area' };

export function useInsightSession() {
  const [generation, setGeneration] = useState(0);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    const suspend = () => setSwitching(true);
    const resume = () => { setGeneration((value) => value + 1); setSwitching(false); };
    window.addEventListener('organization:will-change', suspend);
    window.addEventListener('auth:unauthorized', suspend);
    window.addEventListener('organization:changed', resume);
    return () => {
      window.removeEventListener('organization:will-change', suspend);
      window.removeEventListener('auth:unauthorized', suspend);
      window.removeEventListener('organization:changed', resume);
    };
  }, []);
  const session = useQuery({ queryKey: ['insights-session', generation], queryFn: async () => (await api.api.v1AuthSessionList()).data, enabled: !switching });
  return { session, switching, generation };
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<InsightAnalyticsResponse> {
  return (await api.api.v1InsightsAnalyticsList(filters)).data;
}

export async function getDelivery(repository_id: string | undefined, from: string, to: string): Promise<InsightDeliveryResponse> {
  return (await api.api.v1InsightsDeliveryList({ repository_id, from, to })).data;
}

export function useAnalytics(organizationId: string, filters: AnalyticsFilters, enabled = true) {
  return useQuery({ queryKey: ['insights', organizationId, 'analytics', filters], queryFn: () => getAnalytics(filters), enabled });
}

export function useDelivery(organizationId: string, repositoryId: string, from: string, to: string, enabled = true) {
  return useQuery({ queryKey: ['insights', organizationId, 'delivery', repositoryId, from, to], queryFn: () => getDelivery(repositoryId || undefined, from, to), enabled });
}

export async function getRepositories(): Promise<RepositoryPage> {
  const response = await api.api.v1RepositoriesList();
  return (response.data.data ?? []).filter((repository): repository is Repository => Boolean(repository.id));
}

export async function getInsights(repositoryId: string): Promise<InsightsResponse> {
  return (await api.api.v1InsightsList({ repository_id: repositoryId })).data.data! as InsightsResponse;
}

export function useRepositories(organizationId: string) {
  return useQuery({ queryKey: ['insights', organizationId, 'repositories'], queryFn: getRepositories });
}

export function useInsights(repositoryId: string, organizationId: string) {
  return useQuery({ queryKey: ['insights', organizationId, 'repository', repositoryId], queryFn: () => getInsights(repositoryId), enabled: Boolean(repositoryId) });
}

export function formatPercent(rate: number, denominator: number, complete: boolean): string {
  if (!complete) return 'Sync delivery history to calculate';
  if (denominator === 0) return 'N/A — no eligible records';
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatCycleTime(completed: number, seconds: number, complete: boolean): string {
  if (!complete) return 'Sync delivery history to calculate';
  if (completed === 0) return 'N/A — no completed issues';
  const days = seconds / 86400;
  return `${days.toFixed(1)} days`;
}
