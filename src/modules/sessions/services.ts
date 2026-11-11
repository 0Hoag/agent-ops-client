import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { AgentrunAgentRun } from '../../shared/api/generated/Api';
// Explicit brief exception: reuse existing typed run transport, not its unscoped hooks.
import { getRuns, getRunTimeline } from '../runs/services/runs';

export async function getSessionRuns(runId: string, repositoryId?: string) {
  const rows: AgentrunAgentRun[] = [];
  for (let page = 1; ; page += 1) {
    const response = await getRuns({ repository_id: repositoryId, page, per_page: 100 });
    rows.push(...response.data);
    if (response.data.length < 100) break;
  }
  const selected = rows.find((run) => run.id === runId);
  return selected ? rows.filter((run) => run.id === selected.id || Boolean(selected.session_id && run.session_id === selected.session_id && run.repository_id === selected.repository_id)) : [];
}
export function useSessionOrganization() {
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
  const session = useQuery({ queryKey: ['session-detail-organization', generation], queryFn: async () => (await api.api.v1AuthSessionList()).data, enabled: !switching });
  return { session, switching, generation };
}
export function useSession(organizationId: string, runId: string, repositoryId?: string) {
  return useQuery({ queryKey: ['session-detail', organizationId, runId, repositoryId], queryFn: () => getSessionRuns(runId, repositoryId), enabled: Boolean(runId) });
}
export function useRepositories(organizationId: string) {
  return useQuery({ queryKey: ['session-detail', organizationId, 'repositories'], queryFn: async () => (await api.api.v1RepositoriesList()).data.data ?? [] });
}
export function useTimeline(organizationId: string, runId?: string) {
  return useQuery({ queryKey: ['session-detail', organizationId, 'timeline', runId], queryFn: () => getRunTimeline(runId!), enabled: Boolean(runId) });
}
