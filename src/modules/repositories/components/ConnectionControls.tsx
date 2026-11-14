import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RepositorysettingsCreateRequest, RepositorysettingsView } from '../../../shared/api/generated/Api';
import { syncRepository, testRepository } from '../services/repositories';

/** Tests unsaved credentials without creating a repository or retaining mutation variables. */
export function TestConnection({ form }: { form: RepositorysettingsCreateRequest }) {
  const test = useMutation({ mutationFn: () => testRepository({ provider: form.provider, full_name: form.full_name, base_url: form.gitlab_base_url || 'https://api.github.com', token: form.backfill_token }) });
  return <div><button type="button" disabled={test.isPending || !form.full_name || !form.backfill_token} onClick={() => test.mutate()}>Test connection</button>
    {test.isSuccess && <p role="status">Connected to {test.data?.project_name}.</p>}
    {test.isError && <p role="alert">Unable to connect. Check the provider URL, repository name and backfill credential, then retry Test connection.</p>}
  </div>;
}

/** Syncs a persisted repository and refreshes its server-reported status. */
export function RepositorySync({ repository }: { repository: RepositorysettingsView }) {
  const client = useQueryClient();
  const sync = useMutation({ mutationFn: () => syncRepository(repository.id!), onSuccess: () => void client.invalidateQueries({ queryKey: ['repositories'] }) });
  return <div><p>Sync status: {repository.last_sync_status || 'Not synced yet'}</p>
    <button type="button" disabled={!repository.id || sync.isPending} onClick={() => sync.mutate()}>Sync now</button>
    {sync.isError && <p role="alert">Unable to sync. Check the repository credentials and provider connection, then retry Sync now.</p>}
  </div>;
}
