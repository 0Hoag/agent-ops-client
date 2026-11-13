import { useEffect, useRef, useState } from 'react';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { createWave, getWorker, listWaves, listWorkerAuditHistory, restartWorker, startWorker, stopWorker, updateWaveBrief, updateWaveState, type WorkerJob } from './service';
import { subscribeToWorkerLogs } from './liveLogs';
import { AuditEntry } from './AuditEntry';

const briefTemplates = [
  { name: 'Release plan', brief: '## Goals\n\n## Scope\n\n## Risks\n' },
  { name: 'Migration plan', brief: '## Migration steps\n\n## Validation\n\n## Rollback\n' },
];
const waveStates = ['todo', 'in_progress', 'review', 'blocked', 'done'];
const stateLabels: Record<string, string> = { todo: 'Ready', in_progress: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done' };
const requestFields = [{ key: 'wave', label: 'Batch' }, { key: 'branch', label: 'Branch' }, { key: 'worktree', label: 'Working folder' }, { key: 'script', label: 'Tool' }, { key: 'brief', label: 'Brief' }] as const;

export function WavesPage() {
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [role, setRole] = useState('');
  const [worker, setWorker] = useState<WorkerJob | null>(null);
  const [workerLogs, setWorkerLogs] = useState<string[]>([]);
  const [logsComplete, setLogsComplete] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [workerRequest, setWorkerRequest] = useState({ wave: '', branch: '', worktree: '', script: '', brief: '' });
  const [auditPage, setAuditPage] = useState(1);
  const canControl = role === 'owner' || role === 'admin';
  const canStart = !!workerRequest.wave;
  const generation = useRef(0);
  const auditOrganizationId = useRef(organizationId);
  auditOrganizationId.current = organizationId;
  useEffect(() => {
    if (!organizationId || !canControl || !['agents', 'logs'].includes(window.location.hash.slice(1))) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.();
  }, [organizationId, canControl]);
  useEffect(() => {
    setWorkerLogs([]); setLogsComplete(false); setLogsError(false);
    if (!worker?.ID || !organizationId || !canControl) return;
    return subscribeToWorkerLogs(worker.ID, (line) => setWorkerLogs((lines) => [...lines, line]), () => setLogsComplete(true), () => setLogsError(true));
  }, [worker?.ID, organizationId, canControl]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const current = ++generation.current;
      setOrganizationId(''); setRole(''); setWorker(null); setAuditPage(1); setWorkerRequest({ wave: '', branch: '', worktree: '', script: '', brief: '' });
      void api.api.v1AuthSessionList().then(async (response) => {
        const org = response.data.organization_id ?? ''; const account = response.data.account_id ?? '';
        if (!org || !account) return;
        try { const members = await api.api.v1OrganizationsMembersList(org); if (active && current === generation.current) { setOrganizationId(org); setRole((members.data.data as { account_id: string; role: string }[] | undefined)?.find((item) => item.account_id === account)?.role ?? ''); } } catch { if (active && current === generation.current) { setOrganizationId(org); setRole(''); } }
      }).catch(() => { if (active && current === generation.current) setOrganizationId(''); });
    };
    const clear = () => { generation.current++; setOrganizationId(''); setRole(''); setWorker(null); setAuditPage(1); setWorkerRequest({ wave: '', branch: '', worktree: '', script: '', brief: '' }); void client.cancelQueries({ queryKey: ['waves'] }); void client.cancelQueries({ queryKey: ['worker-audit'] }); };
    refresh();
    window.addEventListener('organization:will-change', clear);
    window.addEventListener('organization:changed', refresh);
    return () => { active = false; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  const query = useQuery({ queryKey: ['waves', organizationId], enabled: !!organizationId, queryFn: listWaves });
  const audit = useQuery({ queryKey: ['worker-audit', organizationId, auditPage, 10], enabled: !!organizationId && (role === 'owner' || role === 'admin'), queryFn: () => listWorkerAuditHistory(auditPage, 10) });
  const invalidate = () => client.invalidateQueries({ queryKey: ['waves', organizationId] });
  const refreshAudit = () => client.invalidateQueries({ queryKey: ['worker-audit', organizationId], refetchType: 'all' });
  const refreshAcceptedAudit = () => { void refreshAudit(); };
  const refreshRejectedAudit = () => { window.setTimeout(() => { if (auditOrganizationId.current === organizationId) refreshAcceptedAudit(); }, 0); };
  const create = useMutation({ mutationFn: () => createWave({ name, brief }), onSuccess: () => { setName(''); setBrief(''); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, state }: { id: string; state: string }) => updateWaveState(id, state), onSuccess: () => void invalidate() });
  const saveBrief = useMutation({ mutationFn: ({ id, brief }: { id: string; brief: string }) => updateWaveBrief(id, brief), onSuccess: () => void invalidate() });
  const start = useMutation({ mutationFn: startWorker, onSuccess: (job) => { setWorker(job); refreshAcceptedAudit(); }, onError: refreshRejectedAudit });
  const status = useMutation({ mutationFn: getWorker, onSuccess: (job) => setWorker(job) });
  const stop = useMutation({ mutationFn: stopWorker, onSuccess: refreshAcceptedAudit, onError: refreshRejectedAudit });
  const restart = useMutation({ mutationFn: restartWorker, onSuccess: (job) => { setWorker(job); refreshAcceptedAudit(); }, onError: refreshRejectedAudit });
  const waves = query.data ?? [];
  return <section className="readable-controls [&_label]:mb-2 [&_label]:grid [&_label]:gap-1"><h1 className="mb-2 text-2xl font-semibold">Plan and track organization work</h1><p className="mb-5">Create batches, write briefs, and track progress.</p>
    {!organizationId && <p role="status">Select an organization to view batches.</p>}
    {!!organizationId && query.isPending && <p role="status">Loading batches…</p>}
    {!!organizationId && query.isError && <div role="alert">Unable to load batches. <button onClick={() => void query.refetch()}>Retry</button></div>}
    {!!organizationId && !query.isPending && !query.isError && waves.length === 0 && <p>No batches found.</p>}
    {!!organizationId && !query.isPending && !query.isError && waves.length === 0 && <SetupLinks />}
    {!!organizationId && !role && <p role="alert">Agent controls and live logs are unavailable because your organization permissions could not be verified. Reload to try again.</p>}
    {!!organizationId && role && !canControl && <p>Read-only: only organization owners and admins can control agents and view their live logs.</p>}
     {canControl && organizationId && <><nav aria-label="Advanced destinations" className="flex flex-wrap gap-3"><a href="/waves#agents">Advanced agent controls</a><a href="/waves#logs">Live logs</a></nav><section id="agents" className="my-5 grid max-w-xl gap-2 border p-3" aria-label="Advanced agent controls"><h2>Advanced agent controls</h2><p>Start an agent for a selected batch, then check, stop, or restart that job.</p>{requestFields.map(({ key, label }) => <label key={key}>{label}<input className="w-full min-w-0" aria-label={label} required={key === 'wave' || key === 'branch' || key === 'worktree' || key === 'script'} value={workerRequest[key]} onChange={(event) => setWorkerRequest((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<button disabled={start.isPending || !canStart} onClick={() => start.mutate({ ...workerRequest })}>Start agent</button>{worker && <><p>Agent {worker.ID}: {stateLabels[worker.State] ?? worker.State}</p><button disabled={status.isPending} onClick={() => status.mutate(worker.ID)}>Refresh status</button><button disabled={stop.isPending} onClick={() => stop.mutate(worker.ID)}>Stop agent</button><button disabled={restart.isPending} onClick={() => restart.mutate(worker.Request ?? workerRequest)}>Restart agent</button></>}{[start, status, stop, restart].some((mutation) => mutation.isError) && <p role="alert">Agent action failed: {((start.error || status.error || stop.error || restart.error) as Error)?.message}</p>}</section><section id="logs" className="my-5 border p-3" aria-label="Live logs"><h2>Live logs</h2><p>The API only logs the selected job started here. A separate browser for all logs is unavailable; you cannot find or reconnect to another job here.</p>{worker ? <>{workerLogs.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}{logsComplete && <p role="status">Agent completed.</p>}{logsError && <p role="alert">Agent log connection failed.</p>}</> : <p>Start an agent here to view its live logs.</p>}</section></>}
    {canControl && organizationId && <section className="my-5 border p-3" aria-label="Agent audit history"><h2 className="mb-2 font-semibold">Agent audit history</h2>{audit.isPending && <p role="status">Loading agent audit history…</p>}{audit.isError && <div role="alert">Unable to load agent audit history. <button onClick={() => void audit.refetch()}>Retry</button></div>}{audit.isSuccess && (audit.data.data ?? []).length === 0 && <p>No agent actions found.</p>}{(audit.data?.data ?? []).map((entry) => <article className="border-b py-2" key={entry.id}><AuditEntry entry={entry} /></article>)}{audit.isSuccess && <nav aria-label="Audit history pages" className="mt-2 flex gap-2"><button disabled={auditPage <= 1} onClick={() => setAuditPage((page) => page - 1)}>Previous</button><span>Page {auditPage}</span><button disabled={audit.data.meta?.total !== undefined ? auditPage * 10 >= audit.data.meta.total : (audit.data.data ?? []).length < 10} onClick={() => setAuditPage((page) => page + 1)}>Next</button></nav>}</section>}
    {!!organizationId && !query.isPending && !query.isError && <div className="grid gap-4 md:grid-cols-3">{waveStates.map((state) => <section key={state} aria-label={`${stateLabels[state]} batches`}><h2 className="mb-2 font-semibold">{stateLabels[state]}</h2>{waves.filter((wave) => wave.state === state).map((wave) => { const id = wave.id ?? ''; const value = briefs[id] ?? wave.brief ?? ''; return <article className="mb-3 border bg-white p-3" key={wave.id}><h3 className="font-medium">{wave.name}</h3><label>Brief template for {wave.name}<select aria-label={`Brief template for ${wave.name}`} value="" onChange={(event) => { const template = briefTemplates.find((item) => item.name === event.target.value); if (template) setBriefs((current) => ({ ...current, [id]: template.brief })); }}><option value="">Choose template</option>{briefTemplates.map((template) => <option key={template.name}>{template.name}</option>)}</select></label><label>Brief for {wave.name}<textarea aria-label={`Brief for ${wave.name}`} value={value} onChange={(event) => setBriefs((current) => ({ ...current, [id]: event.target.value }))} /></label><button disabled={saveBrief.isPending || !wave.id} onClick={() => wave.id && saveBrief.mutate({ id: wave.id, brief: value })}>Save brief</button><label>State <select aria-label={`State for ${wave.name}`} value={wave.state} disabled={update.isPending} onChange={(event) => wave.id && update.mutate({ id: wave.id, state: event.target.value })}>{waveStates.map((option) => <option key={option} value={option}>{stateLabels[option]}</option>)}</select></label></article>; })}</section>)}</div>}
    {!!organizationId && <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><h2 className="text-lg font-semibold">Create batch</h2><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Brief<textarea value={brief} onChange={(event) => setBrief(event.target.value)} /></label><button disabled={create.isPending}>Create batch</button></form>}
    {(create.isError || update.isError || saveBrief.isError) && <p role="alert">Unable to save batch.</p>}
  </section>;
}
