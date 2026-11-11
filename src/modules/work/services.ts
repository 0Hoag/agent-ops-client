import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';

export type WorkFilters = { repository_id: string; state?: string; q?: string };
export function useWorkRepositories() {
  return useQuery({ queryKey: ['work-repositories'], queryFn: () => api.api.v1RepositoriesList().then(({ data }) => data.data ?? []) });
}
export function useWork(filters: WorkFilters) {
  return useQuery({ queryKey: ['work', filters], queryFn: () => api.api.v1WorkList(filters).then(({ data }) => data), enabled: Boolean(filters.repository_id) });
}
export function useWorkDetail(filters: WorkFilters, kind: string, number: number) {
  return useQuery({ queryKey: ['work-detail', filters.repository_id, kind, number], queryFn: () => api.api.v1WorkDetail(kind, number, { repository_id: filters.repository_id }).then(({ data }) => data), enabled: Boolean(filters.repository_id && kind && number) });
}
