import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { AgentrunAgentRun, InsightAnalyticsResponse, InsightOverviewResponse } from '../../shared/api/generated/Api';

// Generated v1InsightsAnalyticsList types the body as InsightAnalyticsResponse,
// but the API controller wraps that payload in { data: ... }.
type AnalyticsEnvelope = { data: InsightAnalyticsResponse };

export type Filters = { from: string; to: string; repository_id?: string };
export function dateRange(preset: string, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (preset === 'Today' ? 0 : preset === '7 days' ? 6 : 29));
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
export async function getSessions(filters: Filters) {
  const rows: AgentrunAgentRun[] = [];
  for (let page = 1; ; page += 1) {
    const response = (await api.api.v1AgentRunsList({ repository_id: filters.repository_id, started_after: `${filters.from}T00:00:00Z`, started_before: `${filters.to}T23:59:59.999999999Z`, page, per_page: 100 })).data;
    rows.push(...(response.data ?? []));
    if ((response.data?.length ?? 0) < 100) return rows;
  }
}
export function useUsageSession() {
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
  const session = useQuery({ queryKey: ['usage-session', generation], queryFn: async () => (await api.api.v1AuthSessionList()).data, enabled: !switching });
  return { session, switching, generation };
}
export function useUsage(organizationId: string, filters: Filters, enabled: boolean) {
  const repositories = useQuery({ queryKey: ['usage', organizationId, 'repositories'], queryFn: async () => (await api.api.v1RepositoriesList()).data.data ?? [] });
  const runs = useQuery({ queryKey: ['usage', organizationId, 'sessions', filters], queryFn: () => getSessions(filters), enabled });
  const analytics = useQuery({ queryKey: ['usage', organizationId, 'daily', filters], queryFn: async () => ((await api.api.v1InsightsAnalyticsList({ ...filters, period: 'daily', group_by: 'harness' })).data as unknown as AnalyticsEnvelope).data, enabled });
  const overview = useQuery({ queryKey: ['usage', organizationId, 'summary', filters], queryFn: async () => ((await api.api.v1OverviewList(filters)).data as unknown as { data: InsightOverviewResponse }).data, enabled });
  return { repositories, runs, analytics, overview };
}
