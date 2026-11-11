import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { AgentrunPriceVersion, InsightAnalyticsResponse, InsightOverviewResponse } from '../../shared/api/generated/Api';

export function useOnboarding(organizationId: string) {
  return useQuery({
    queryKey: ['onboarding', organizationId], enabled: Boolean(organizationId),
    queryFn: async () => {
      const [repositories, runs, prices, missing] = await Promise.all([
        api.api.v1RepositoriesList(), api.api.v1AgentRunsList({ page: 1, per_page: 1 }),
        api.api.v1AgentRunPricesList(), api.api.v1AgentRunPricesMissingList(),
      ]);
      const versions = (prices.data.data ?? []) as AgentrunPriceVersion[];
      return {
        repository: Boolean(repositories.data.data?.length),
        session: Boolean(runs.data.data?.length),
        prices: versions.some((price) => Boolean(price.model && price.effective_date && Date.parse(price.effective_date) <= Date.now())) && !(missing.data.data as unknown[] | undefined)?.length,
      };
    },
  });
}

export type OverviewFilters = { from: string; to: string; repository_id?: string };

export function getOverview(filters: OverviewFilters) {
  return api.api.v1OverviewList(filters).then((response) => (response.data as unknown as { data: InsightOverviewResponse }).data);
}

export function useOverview(organizationId: string, filters: OverviewFilters) {
  return useQuery({ queryKey: ['overview', organizationId, filters], queryFn: () => getOverview(filters), enabled: Boolean(organizationId) });
}

export function useDailySpend(organizationId: string, filters: OverviewFilters) {
  return useQuery({
    queryKey: ['overview-daily-spend', organizationId, filters], enabled: Boolean(organizationId),
    queryFn: () => api.api.v1InsightsAnalyticsList({ ...filters, period: 'daily' }).then((response) => (response.data as unknown as { data: InsightAnalyticsResponse }).data),
  });
}
