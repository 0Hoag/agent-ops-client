import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';

export function useSetupRepositories(enabled: boolean) {
  const session = useQuery({ queryKey: ['settings-setup-session'], queryFn: async () => (await api.api.v1AuthSessionList()).data, enabled });
  const organizationId = session.data?.organization_id;
  const repositories = useQuery({
    queryKey: ['settings-setup-repositories', organizationId], enabled: enabled && Boolean(organizationId),
    queryFn: async () => (await api.api.v1RepositoriesList()).data.data ?? [],
  });
  return { session, repositories };
}
