import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { RepositorysettingsCreateRequest } from '../../shared/api/generated/Api';
import { createRepository, deleteRepository, getRepositoryRole, listRepositories, updateRepository } from './services/repositories';
import { emptyRepositoryForm, parseStatusMappings, repositoryUpdate } from './form';

/** Organization-scoped repository provider configuration. */
export function RepositoriesPage() {
  const client = useQueryClient();
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState(emptyRepositoryForm);
  const [secret, setSecret] = useState('');
  const refreshGeneration = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = () => { const generation = ++refreshGeneration.current; setOrg(''); setRole(''); setSecret(''); setForm(emptyRepositoryForm()); void api.api.v1AuthSessionList().then(async (r) => { const orgId = r.data.organization_id ?? ''; const accountId = r.data.account_id ?? ''; if (!orgId || !accountId) return; const memberRole = await getRepositoryRole(orgId, accountId); if (active && generation === refreshGeneration.current) { setOrg(orgId); setRole(memberRole ?? ''); } }).catch(() => { if (active && generation === refreshGeneration.current) { setOrg(''); setRole(''); } }); };
    const clearSensitive = () => { refreshGeneration.current++; setOrg(''); setRole(''); setSecret(''); setForm(emptyRepositoryForm()); void client.cancelQueries({ queryKey: ['repositories'] }); };
    refresh(); window.addEventListener('organization:will-change', clearSensitive); window.addEventListener('organization:changed', refresh);
    return () => { active = false; window.removeEventListener('organization:will-change', clearSensitive); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  useEffect(() => { const clear = () => { setSecret(''); setForm(emptyRepositoryForm()); }; window.addEventListener('popstate', clear); window.addEventListener('pagehide', clear); window.addEventListener('auth:unauthorized', clear); return () => { window.removeEventListener('popstate', clear); window.removeEventListener('pagehide', clear); window.removeEventListener('auth:unauthorized', clear); }; }, []);
  const query = useQuery({ queryKey: ['repositories', org], enabled: !!org, queryFn: listRepositories });
  const invalidate = () => client.invalidateQueries({ queryKey: ['repositories', org] });
  const create = useMutation({ mutationKey: ['repositories', org, 'create'], mutationFn: (input: RepositorysettingsCreateRequest) => createRepository(input), onSuccess: (r) => { if (r?.webhook_secret) setSecret(r.webhook_secret); setForm(emptyRepositoryForm()); void invalidate(); }, onError: () => setForm(emptyRepositoryForm()), onSettled: () => { client.getMutationCache().findAll({ mutationKey: ['repositories', org] }).forEach((mutation) => client.getMutationCache().remove(mutation)); } });
  const update = useMutation({ mutationKey: ['repositories', org, 'update'], mutationFn: ({ id, input }: { id: string; input: ReturnType<typeof repositoryUpdate> }) => updateRepository(id, input), onSuccess: () => void invalidate(), onSettled: () => { client.getMutationCache().findAll({ mutationKey: ['repositories', org] }).forEach((mutation) => client.getMutationCache().remove(mutation)); } });
  const remove = useMutation({ mutationKey: ['repositories', org, 'delete'], mutationFn: deleteRepository, onSuccess: () => void invalidate(), onSettled: () => { client.getMutationCache().findAll({ mutationKey: ['repositories', org] }).forEach((mutation) => client.getMutationCache().remove(mutation)); } });
  const canEdit = role === 'owner' || role === 'admin';
  return <section><h1 className="mb-5 text-2xl font-semibold">Repository settings</h1>
    {!org && <p role="status">Select an organization to view repositories.</p>}
    {!!org && query.isPending && <p role="status">Loading repositories…</p>}{!!org && query.isError && <p role="alert">Unable to load repositories: {query.error.message}</p>}
    {query.data?.length === 0 && <p>No repositories configured.</p>}
    {query.data?.map((item) => <article className="mb-4 border bg-white p-4" key={item.id}><h2 className="font-semibold">{item.full_name} <span className="text-sm">({item.provider})</span></h2>{item.webhook_url && <p>Webhook: {item.webhook_url}</p>}{item.gitlab_base_url && <p>GitLab URL: {item.gitlab_base_url}</p>}<p>Status mappings: {JSON.stringify(item.status_mappings ?? {})}</p>{canEdit && <><button onClick={() => { const base = window.prompt('GitLab base URL', item.gitlab_base_url ?? ''); const mappings = window.prompt('Status mappings JSON', JSON.stringify(item.status_mappings ?? {})); if (item.id && base !== null && mappings !== null) { const parsed = parseStatusMappings(mappings); if (parsed) update.mutate({ id: item.id, input: repositoryUpdate(base, parsed, item.provider === 'gitlab') }); else window.alert('Status mappings must be a JSON object with string values.'); } }}>Edit settings</button><button className="ml-3" onClick={() => item.id && remove.mutate(item.id)}>Delete</button></>}</article>)}
    {canEdit && <form className="mt-5 grid max-w-xl gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form }); }}><h2 className="text-lg font-semibold">Add repository</h2><label>Provider<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option value="github">GitHub</option><option value="gitlab">GitLab</option></select></label><label>Full name<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}/></label>{form.provider === 'gitlab' && <label>Self-hosted base URL<input value={form.gitlab_base_url ?? ''} onChange={(e) => setForm({ ...form, gitlab_base_url: e.target.value })}/></label>}<label>Status mappings (JSON)<textarea value={JSON.stringify(form.status_mappings ?? {})} onChange={(e) => { const mappings = parseStatusMappings(e.target.value); if (mappings) setForm({ ...form, status_mappings: mappings }); }}/></label><label>Webhook credential<input type="password" autoComplete="new-password" value={form.webhook_secret ?? ''} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}/></label><label>Backfill credential<input type="password" autoComplete="new-password" value={form.backfill_token ?? ''} onChange={(e) => setForm({ ...form, backfill_token: e.target.value })}/></label><button disabled={create.isPending}>Create repository</button></form>}
    {(create.isError || update.isError || remove.isError) && <p role="alert">Unable to save repository settings.</p>}{secret && <aside role="alert"><p>Webhook secret (shown once): <code>{secret}</code></p><button onClick={() => setSecret('')}>Dismiss</button></aside>}
  </section>;
}
