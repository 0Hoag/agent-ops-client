import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AgentrunPriceVersion } from '../../shared/api/generated/Api';
import { api } from '../../shared/api/client';
import { createPrice, updatePrice } from './services/client';
import { priceQueryKey, usePrices, validPrice } from './services/pricing';
import { exactTime } from '../../shared/format';

const blank = (): AgentrunPriceVersion => ({ model: '', effective_date: new Date().toISOString().slice(0, 10), input_per_million: 0, cached_input_per_million: 0, cache_write_per_million: 0, output_per_million: 0, reasoning_per_million: 0 });
const fields = ['input_per_million', 'cached_input_per_million', 'cache_write_per_million', 'output_per_million', 'reasoning_per_million'] as const;

export function PricingPage() {
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState('');
  const [organizationReady, setOrganizationReady] = useState(false);
  const [organizationError, setOrganizationError] = useState('');
  const retryOrganization = useRef(() => {});
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const query = usePrices(organizationId);
  useEffect(() => {
    let generation = 0;
    const load = async (session?: { org: string; account: string }) => {
      const request = ++generation;
      setOrganizationError(''); setOrganizationReady(false);
      let step = session ? 'organization permissions' : 'session';
      try {
        if (!session) {
          const response = await api.api.v1AuthSessionList();
          if (request !== generation) return;
          session = { org: response.data.organization_id ?? '', account: response.data.account_id ?? '' };
        }
        if (!session.org) { setOrganizationReady(true); return; }
        step = 'organization permissions';
        const members = await api.api.v1OrganizationsMembersList(session.org);
        if (request !== generation) return;
        const account = session.account;
        const memberRole = (members.data.data as { account_id: string; role: string }[] | undefined)?.find((item) => item.account_id === account)?.role ?? '';
        setOrganizationId(session.org); setRole(memberRole); setOrganizationReady(true);
      } catch (error) {
        if (request !== generation) return;
        setOrganizationId(''); setRole(''); setOrganizationReady(true);
        setOrganizationError(`Unable to load ${step}: ${error instanceof Error ? error.message : 'Request failed'}`);
        retryOrganization.current = () => { void load(session); };
      }
    };
    const clear = () => { ++generation; setOrganizationId(''); setRole(''); setOrganizationError(''); setOrganizationReady(false); setDraft(blank()); setEditingId(''); retryOrganization.current = () => {}; void client.cancelQueries({ queryKey: ['prices'] }); };
    const refresh = () => { clear(); void load(); };
    refresh(); window.addEventListener('organization:will-change', clear); window.addEventListener('organization:changed', refresh);
    return () => { ++generation; retryOrganization.current = () => {}; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  const invalidate = () => client.invalidateQueries({ queryKey: priceQueryKey(organizationId) });
  const create = useMutation({ mutationFn: createPrice, onSuccess: () => { setDraft(blank()); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, price }: { id: string; price: AgentrunPriceVersion }) => updatePrice(id, price), onSuccess: () => { setDraft(blank()); setEditingId(''); void invalidate(); } });
  const canEdit = role === 'owner' || role === 'admin';
  const save = () => { if (!validPrice(draft)) return; if (editingId) update.mutate({ id: editingId, price: draft }); else create.mutate(draft); };
  return <section><header className="mb-5"><h1 className="text-2xl font-semibold">Model prices</h1><p className="text-sm text-slate-600">Versioned USD prices per million tokens, effective by date</p></header>
    {!organizationReady && <p role="status">Loading organization permissions…</p>}
    {organizationError && <div role="alert">{organizationError} <button onClick={() => retryOrganization.current()}>Retry</button></div>}
    {organizationReady && !organizationError && !organizationId && <p>Select an organization to view model prices.</p>}
    {organizationId && query.isPending && <p role="status">Loading model prices…</p>}{organizationId && query.isError && <div role="alert">Unable to load prices: {query.error.message} <button disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Retry</button></div>}
    {organizationId && query.data?.length === 0 && <p>No model prices configured.</p>}
    {organizationId && query.data && <div className="overflow-x-auto rounded bg-white"><table className="responsive-table w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Model', 'Effective date', ...fields.map((field) => `${field.replace('_per_million', '').replaceAll('_', ' ')} / million`), ''].map((name) => <th className="p-3" key={name}>{name}</th>)}</tr></thead><tbody>{query.data.map((price) => <tr className="border-t" key={price.id}><td data-label="Model" className="p-3">{price.model}</td><td data-label="Effective date" className="p-3"><time dateTime={price.effective_date} title={exactTime(price.effective_date)}>{price.effective_date ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(price.effective_date)) : 'Set effective date'}</time></td>{fields.map((field) => <td data-label={`${field.replace('_per_million', '').replaceAll('_', ' ')} / million`} className="p-3" key={field}>{price[field] ?? '—'}</td>)}<td>{canEdit && <button onClick={() => { setDraft({ ...price, effective_date: price.effective_date?.slice(0, 10) }); setEditingId(price.id ?? ''); }}>Edit</button>}</td></tr>)}</tbody></table></div>}
    {canEdit && organizationId && <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); save(); }}><h2 className="text-lg font-semibold">{editingId ? 'Edit price version' : 'Add price version'}</h2><label>Model<input required className="ml-2 rounded border p-2" value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value })}/></label><label>Effective date<input required type="date" className="ml-2 rounded border p-2" value={draft.effective_date ?? ''} onChange={(event) => setDraft({ ...draft, effective_date: event.target.value })}/></label>{fields.map((field) => <label key={field}>{field.replace('_per_million', '').replaceAll('_', ' ')} per million<input required type="number" min="0" step="any" className="ml-2 rounded border p-2" value={draft[field] ?? 0} onChange={(event) => setDraft({ ...draft, [field]: Number(event.target.value) })}/></label>)}<button className="rounded bg-blue-700 p-2 text-white" disabled={create.isPending || update.isPending}>{editingId ? 'Update version' : 'Create version'}</button>{(create.isError || update.isError) && <p role="alert">Unable to save price version. Check for a duplicate or invalid version.</p>}</form>}
    {!!organizationId && !canEdit && role && <p className="mt-4 text-slate-600">Read-only: only organization owners and admins can edit prices.</p>}
  </section>;
}
