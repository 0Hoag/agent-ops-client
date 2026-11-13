import { useEffect, useState } from 'react';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetRequest } from '../../shared/api/generated/Api';
import { budgetSession, createBudget, deleteBudget, listBudgets, listBudgetRepositories, updateBudget } from './services/client';

const blank = (): BudgetRequest => ({ starts_at: new Date().toISOString().slice(0, 10), ends_at: '', repository_id: '', wave: '', token_limit: undefined, usd_limit: undefined });
export function BudgetsPage() {
  const client = useQueryClient(); const [org, setOrg] = useState(''); const [role, setRole] = useState(''); const [draft, setDraft] = useState<BudgetRequest>(blank); const [editing, setEditing] = useState('');
  const [sessionError, setSessionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState('');
  useEffect(() => {
    let generation = 0;
    const clear = () => { generation++; setOrg(''); setRole(''); setDraft(blank()); setEditing(''); setValidation(''); setSessionError(false); };
    const refresh = () => {
      clear(); const current = generation;
      void budgetSession().then((session) => { if (current === generation) { setOrg(session.org); setRole(session.role); } }).catch(() => { if (current === generation) setSessionError(true); });
    };
    refresh();
    window.addEventListener('organization:will-change', clear);
    window.addEventListener('organization:changed', refresh);
    return () => { generation++; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [attempt]);
  const query = useQuery({ queryKey: ['budgets', org], queryFn: listBudgets, enabled: !!org }); const invalidate = () => client.invalidateQueries({ queryKey: ['budgets', org] });
  const repositories = useQuery({ queryKey: ['budget-repositories', org], queryFn: listBudgetRepositories, enabled: !!org });
  const create = useMutation({ mutationFn: createBudget, onSuccess: () => { setDraft(blank()); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: BudgetRequest }) => updateBudget(id, input), onSuccess: () => { setDraft(blank()); setEditing(''); void invalidate(); } });
  const remove = useMutation({ mutationFn: deleteBudget, onSuccess: () => { setDraft(blank()); setEditing(''); void invalidate(); } }); const canEdit = role === 'owner' || role === 'admin';
  const save = () => {
    if (!canEdit || !org) return;
    if (draft.repository_id && (!repositories.isSuccess || !repositories.data.some((repo) => repo.id === draft.repository_id))) {
      setValidation('Choose an available repository or All repositories.'); return;
    }
    if (!draft.starts_at || (draft.ends_at && draft.ends_at < draft.starts_at) ||
      (draft.token_limit !== undefined && (!Number.isSafeInteger(draft.token_limit) || draft.token_limit < 0)) ||
      (draft.usd_limit !== undefined && (!Number.isFinite(draft.usd_limit) || draft.usd_limit < 0))) {
      setValidation('Enter a valid date range and non-negative limits (whole tokens).'); return;
    }
    setValidation('');
    const input = { ...draft, ends_at: draft.ends_at || '', repository_id: draft.repository_id?.trim() || '', wave: draft.wave?.trim() || '' };
    if (editing) update.mutate({ id: editing, input }); else create.mutate(input);
  };
  return <section className="[&_label]:grid [&_label]:gap-1 [&_input]:min-w-0 [&_input]:rounded [&_input]:border [&_input]:p-2 [&_select]:rounded [&_select]:border [&_select]:p-2"><h1 className="mb-2 text-2xl font-semibold">Budgets</h1>
    <p className="mb-4">Set spending and token limits for all repositories or a selected repository and batch.</p>
    {!org && !sessionError && <p role="status">Select an organization to view budgets.</p>}{sessionError && <p role="alert">Unable to load budget permissions. <button onClick={() => setAttempt((value) => value + 1)}>Retry</button></p>}{org && query.isPending && <p role="status">Loading budgets…</p>}{org && query.isError && <p role="alert">Unable to load budgets: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}{query.data?.length === 0 && <><p>No budgets configured.</p><SetupLinks /></>}
    {org && repositories.isPending && <p role="status">Loading repositories…</p>}
    {org && repositories.isError && <p role="alert">Unable to load repositories. <button onClick={() => void repositories.refetch()}>Retry</button></p>}
    {query.data?.map((item) => <article className="mb-3 border bg-white p-4" key={item.id}><p>{item.starts_at} – {item.ends_at || 'No end date'}</p><p>Repository: {item.repository_id ? repositories.data?.find((repo) => repo.id === item.repository_id)?.full_name ?? 'Repository unavailable' : 'All repositories'}; Batch: {item.wave || 'All batches'}</p><p>Token limit: {item.token_limit ?? '—'}; USD limit: {item.usd_limit ?? '—'}</p>{canEdit && <><button onClick={() => { setDraft({ starts_at: item.starts_at?.slice(0, 10), ends_at: item.ends_at?.slice(0, 10), repository_id: item.repository_id, wave: item.wave, token_limit: item.token_limit, usd_limit: item.usd_limit }); setEditing(item.id ?? ''); }}>Edit</button><button className="ml-3" disabled={remove.isPending} onClick={() => item.id && remove.mutate(item.id)}>Delete</button></>}</article>)}
    {validation && <p role="alert">{validation}</p>}
    {org && !canEdit && <p>Read-only: only organization owners and admins can edit budgets.</p>}
    {canEdit && org && <form className="mt-5 grid max-w-xl gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}><h2>{editing ? 'Edit budget' : 'Create budget'}</h2><label>Start date<input required type="date" value={draft.starts_at ?? ''} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}/></label><label>End date<input type="date" value={draft.ends_at ?? ''} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}/></label><label className="grid min-w-0 gap-1">Repository<select className="min-w-0 max-w-full" disabled={!repositories.isSuccess} value={draft.repository_id ?? ''} onChange={(e) => setDraft({ ...draft, repository_id: e.target.value })}><option value="">All repositories</option>{draft.repository_id && !repositories.data?.some((repo) => repo.id === draft.repository_id) && <option value={draft.repository_id} disabled>Repository unavailable — select another</option>}{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select></label><label>Batch<input value={draft.wave ?? ''} onChange={(e) => setDraft({ ...draft, wave: e.target.value })}/></label><label>Token limit<input type="number" min="0" step="1" value={draft.token_limit ?? ''} onChange={(e) => setDraft({ ...draft, token_limit: e.target.value === '' ? undefined : Number(e.target.value) })}/></label><label>USD limit<input type="number" min="0" step="any" value={draft.usd_limit ?? ''} onChange={(e) => setDraft({ ...draft, usd_limit: e.target.value === '' ? undefined : Number(e.target.value) })}/></label><button disabled={create.isPending || update.isPending}>{editing ? 'Update budget' : 'Create budget'}</button>{(create.isError || update.isError || remove.isError) && <p role="alert">Unable to save budget: {(create.error || update.error || remove.error)?.message}</p>}</form>}</section>;
}
