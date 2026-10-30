import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { createWave, getWorker, listWaves, restartWorker, startWorker, stopWorker, updateWaveBrief, updateWaveState, type WorkerJob } from './service';

const briefTemplates = [
  { name: 'Release plan', brief: '## Goals\n\n## Scope\n\n## Risks\n' },
  { name: 'Migration plan', brief: '## Migration steps\n\n## Validation\n\n## Rollback\n' },
];
const waveStates = ['todo', 'in_progress', 'review', 'blocked', 'done'];

export function WavesPage() {
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [role, setRole] = useState('');
  const [worker, setWorker] = useState<WorkerJob | null>(null);
  const [workerRequest, setWorkerRequest] = useState({ wave: '', branch: '', worktree: '', script: '', brief: '' });
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const current = ++generation.current;
      setOrganizationId(''); setRole(''); setWorker(null); setWorkerRequest({ wave: '', branch: '', worktree: '', script: '', brief: '' });
      void api.api.v1AuthSessionList().then(async (response) => {
        const org = response.data.organization_id ?? ''; const account = response.data.account_id ?? '';
        if (!org || !account) return;
        try { const members = await api.api.v1OrganizationsMembersList(org); if (active && current === generation.current) { setOrganizationId(org); setRole((members.data.data as { account_id: string; role: string }[] | undefined)?.find((item) => item.account_id === account)?.role ?? ''); } } catch { if (active && current === generation.current) { setOrganizationId(org); setRole(''); } }
      }).catch(() => { if (active && current === generation.current) setOrganizationId(''); });
    };
    const clear = () => { generation.current++; setOrganizationId(''); setRole(''); setWorker(null); setWorkerRequest({ wave: '', branch: '', worktree: '', script: '', brief: '' }); void client.cancelQueries({ queryKey: ['waves'] }); };
    refresh();
    window.addEventListener('organization:will-change', clear);
    window.addEventListener('organization:changed', refresh);
    return () => { active = false; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  const query = useQuery({ queryKey: ['waves', organizationId], enabled: !!organizationId, queryFn: listWaves });
  const invalidate = () => client.invalidateQueries({ queryKey: ['waves', organizationId] });
  const create = useMutation({ mutationFn: () => createWave({ name, brief }), onSuccess: () => { setName(''); setBrief(''); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, state }: { id: string; state: string }) => updateWaveState(id, state), onSuccess: () => void invalidate() });
  const saveBrief = useMutation({ mutationFn: ({ id, brief }: { id: string; brief: string }) => updateWaveBrief(id, brief), onSuccess: () => void invalidate() });
  const canControl = role === 'owner' || role === 'admin';
  const start = useMutation({ mutationFn: startWorker, onSuccess: (job) => setWorker(job) });
  const status = useMutation({ mutationFn: getWorker, onSuccess: (job) => setWorker(job) });
  const stop = useMutation({ mutationFn: stopWorker });
  const restart = useMutation({ mutationFn: restartWorker, onSuccess: (job) => setWorker(job) });
  const waves = query.data ?? [];
  return <section><h1 className="mb-5 text-2xl font-semibold">Organization waves</h1>
    {!organizationId && <p role="status">Select an organization to view waves.</p>}
    {!!organizationId && query.isPending && <p role="status">Loading waves…</p>}
    {!!organizationId && query.isError && <div role="alert">Unable to load waves. <button onClick={() => void query.refetch()}>Retry</button></div>}
    {!!organizationId && !query.isPending && !query.isError && waves.length === 0 && <p>No waves found.</p>}
    {!!organizationId && role && !canControl && <p>Read-only: only organization owners and admins can control workers.</p>}
    {canControl && organizationId && <section className="my-5 grid max-w-xl gap-2 border p-3" aria-label="Worker controls"><h2>Worker controls</h2>{(['wave', 'branch', 'worktree', 'script', 'brief'] as const).map((field) => <label key={field}>{field}<input aria-label={`Worker ${field}`} required value={workerRequest[field]} onChange={(event) => setWorkerRequest((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<button disabled={start.isPending || !workerRequest.wave} onClick={() => start.mutate({ ...workerRequest })}>Start worker</button>{worker && <><p>Worker {worker.ID}: {worker.State}</p><button disabled={status.isPending} onClick={() => status.mutate(worker.ID)}>Refresh status</button><button disabled={stop.isPending} onClick={() => stop.mutate(worker.ID)}>Stop worker</button><button disabled={restart.isPending} onClick={() => restart.mutate(worker.Request ?? workerRequest)}>Restart worker</button></>}{[start, status, stop, restart].some((mutation) => mutation.isError) && <p role="alert">Worker action failed: {((start.error || status.error || stop.error || restart.error) as Error)?.message}</p>}</section>}
    {!!organizationId && !query.isPending && !query.isError && <div className="grid gap-4 md:grid-cols-3">{waveStates.map((state) => <section key={state} aria-label={`${state} waves`}><h2 className="mb-2 font-semibold">{state}</h2>{waves.filter((wave) => wave.state === state).map((wave) => { const id = wave.id ?? ''; const value = briefs[id] ?? wave.brief ?? ''; return <article className="mb-3 border bg-white p-3" key={wave.id}><h3 className="font-medium">{wave.name}</h3><label>Brief template for {wave.name}<select aria-label={`Brief template for ${wave.name}`} value="" onChange={(event) => { const template = briefTemplates.find((item) => item.name === event.target.value); if (template) setBriefs((current) => ({ ...current, [id]: template.brief })); }}><option value="">Choose template</option>{briefTemplates.map((template) => <option key={template.name}>{template.name}</option>)}</select></label><label>Brief for {wave.name}<textarea aria-label={`Brief for ${wave.name}`} value={value} onChange={(event) => setBriefs((current) => ({ ...current, [id]: event.target.value }))} /></label><button disabled={saveBrief.isPending || !wave.id} onClick={() => wave.id && saveBrief.mutate({ id: wave.id, brief: value })}>Save brief</button><label>State <select aria-label={`State for ${wave.name}`} value={wave.state} disabled={update.isPending} onChange={(event) => wave.id && update.mutate({ id: wave.id, state: event.target.value })}>{waveStates.map((option) => <option key={option}>{option}</option>)}</select></label></article>; })}</section>)}</div>}
    {!!organizationId && <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><h2 className="text-lg font-semibold">Create wave</h2><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Brief<textarea value={brief} onChange={(event) => setBrief(event.target.value)} /></label><button disabled={create.isPending}>Create wave</button></form>}
    {(create.isError || update.isError || saveBrief.isError) && <p role="alert">Unable to save wave.</p>}
  </section>;
}
