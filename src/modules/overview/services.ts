import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';

export type OverviewFilters = { from: string; to: string; repository_id?: string };

export function getOverview(filters: OverviewFilters) {
  return api.api.v1OverviewList(filters).then((response) => response.data);
}

export function useOverview(organizationId: string, filters: OverviewFilters) {
  return useQuery({ queryKey: ['overview', organizationId, filters], queryFn: () => getOverview(filters), enabled: Boolean(organizationId) });
}

export function useDailySpend(filters: OverviewFilters) {
  return useQuery({
    queryKey: ['overview-daily-spend', filters],
    queryFn: () => api.api.v1InsightsAnalyticsList({ ...filters, period: 'daily' }).then((response) => response.data),
  });
}
