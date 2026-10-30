import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { createWave, listWaves, updateWaveState } from './service';

export function WavesPage() {
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      setOrganizationId('');
      void api.api.v1AuthSessionList().then((response) => {
        if (active && current === generation) setOrganizationId(response.data.organization_id ?? '');
      }).catch(() => { if (active && current === generation) setOrganizationId(''); });
    };
    const clear = () => { generation++; setOrganizationId(''); void client.cancelQueries({ queryKey: ['waves'] }); };
    refresh();
    window.addEventListener('organization:will-change', clear);
    window.addEventListener('organization:changed', refresh);
    return () => { active = false; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  const query = useQuery({ queryKey: ['waves', organizationId], enabled: !!organizationId, queryFn: listWaves });
  const invalidate = () => client.invalidateQueries({ queryKey: ['waves', organizationId] });
  const create = useMutation({ mutationFn: () => createWave({ name, brief }), onSuccess: () => { setName(''); setBrief(''); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, state }: { id: string; state: string }) => updateWaveState(id, state), onSuccess: () => void invalidate() });
  const waves = query.data ?? [];
  const states = [...new Set(waves.map((wave) => wave.state).filter((state): state is string => !!state))];
  return <section><h1 className="mb-5 text-2xl font-semibold">Organization waves</h1>
    {!organizationId && <p role="status">Select an organization to view waves.</p>}
    {!!organizationId && query.isPending && <p role="status">Loading waves…</p>}
    {!!organizationId && query.isError && <div role="alert">Unable to load waves. <button onClick={() => void query.refetch()}>Retry</button></div>}
    {!!organizationId && !query.isPending && !query.isError && waves.length === 0 && <p>No waves found.</p>}
    {states.length > 0 && <div className="grid gap-4 md:grid-cols-3">{states.map((state) => <section key={state} aria-label={`${state} waves`}><h2 className="mb-2 font-semibold">{state}</h2>{waves.filter((wave) => wave.state === state).map((wave) => <article className="mb-3 border bg-white p-3" key={wave.id}><h3 className="font-medium">{wave.name}</h3>{wave.brief && <p>{wave.brief}</p>}<label>State <select aria-label={`State for ${wave.name}`} value={wave.state} disabled={update.isPending} onChange={(event) => wave.id && update.mutate({ id: wave.id, state: event.target.value })}>{states.map((option) => <option key={option}>{option}</option>)}</select></label></article>)}</section>)}</div>}
    {!!organizationId && <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><h2 className="text-lg font-semibold">Create wave</h2><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Brief<textarea value={brief} onChange={(event) => setBrief(event.target.value)} /></label><button disabled={create.isPending}>Create wave</button></form>}
    {(create.isError || update.isError) && <p role="alert">Unable to save wave.</p>}
  </section>;
}
