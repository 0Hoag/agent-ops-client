import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AgentrunPriceVersion } from '../../shared/api/generated/Api';
import { api } from '../../shared/api/client';
import { createPrice, updatePrice } from './services/client';
import { priceQueryKey, usePrices, validPrice } from './services/pricing';

const blank = (): AgentrunPriceVersion => ({ model: '', effective_date: new Date().toISOString().slice(0, 10), input_per_million: 0, cached_input_per_million: 0, cache_write_per_million: 0, output_per_million: 0, reasoning_per_million: 0 });
const fields = ['input_per_million', 'cached_input_per_million', 'cache_write_per_million', 'output_per_million', 'reasoning_per_million'] as const;

export function PricingPage() {
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState('');
  const [organizationReady, setOrganizationReady] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const query = usePrices(organizationId);
  useEffect(() => {
    let active = true;
    const refresh = () => { setOrganizationId(''); setRole(''); setOrganizationReady(false); setDraft(blank()); setEditingId(''); void api.api.v1AuthSessionList().then(async (session) => {
      const org = session.data.organization_id ?? ''; const account = session.data.account_id ?? '';
      if (!org) { if (active) setOrganizationReady(true); return; }
      const members = await api.api.v1OrganizationsMembersList(org);
      const memberRole = (members.data.data as { account_id: string; role: string }[] | undefined)?.find((item) => item.account_id === account)?.role ?? '';
      if (active) { setOrganizationId(org); setRole(memberRole); setOrganizationReady(true); }
    }).catch(() => { if (active) { setOrganizationId(''); setRole(''); } }); };
    const clear = () => { setOrganizationId(''); setRole(''); setOrganizationReady(false); setDraft(blank()); setEditingId(''); void client.cancelQueries({ queryKey: ['prices'] }); };
    refresh(); window.addEventListener('organization:will-change', clear); window.addEventListener('organization:changed', refresh);
    return () => { active = false; window.removeEventListener('organization:will-change', clear); window.removeEventListener('organization:changed', refresh); };
  }, [client]);
  const invalidate = () => client.invalidateQueries({ queryKey: priceQueryKey(organizationId) });
  const create = useMutation({ mutationFn: createPrice, onSuccess: () => { setDraft(blank()); void invalidate(); } });
  const update = useMutation({ mutationFn: ({ id, price }: { id: string; price: AgentrunPriceVersion }) => updatePrice(id, price), onSuccess: () => { setDraft(blank()); setEditingId(''); void invalidate(); } });
  const canEdit = role === 'owner' || role === 'admin';
  const save = () => { if (!validPrice(draft)) return; if (editingId) update.mutate({ id: editingId, price: draft }); else create.mutate(draft); };
  return <section><header className="mb-5"><h1 className="text-2xl font-semibold">Model prices</h1><p className="text-sm text-slate-600">Versioned USD prices per million tokens, effective by date</p></header>
    {!organizationReady && <p role="status">Select an organization to view model prices.</p>}
    {organizationId && query.isPending && <p role="status">Loading model prices…</p>}{organizationId && query.isError && <p role="alert">Unable to load prices: {query.error.message}</p>}
    {organizationId && query.data?.length === 0 && <p>No model prices configured.</p>}
    {organizationId && query.data && <div className="overflow-x-auto rounded bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Model', 'Effective date', ...fields.map((field) => `${field.replace('_per_million', '').replaceAll('_', ' ')} / million`), ''].map((name) => <th className="p-3" key={name}>{name}</th>)}</tr></thead><tbody>{query.data.map((price) => <tr className="border-t" key={price.id}><td className="p-3">{price.model}</td><td className="p-3">{price.effective_date}</td>{fields.map((field) => <td className="p-3" key={field}>{price[field] ?? '—'}</td>)}<td>{canEdit && <button onClick={() => { setDraft({ ...price }); setEditingId(price.id ?? ''); }}>Edit</button>}</td></tr>)}</tbody></table></div>}
    {canEdit && organizationId && <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); save(); }}><h2 className="text-lg font-semibold">{editingId ? 'Edit price version' : 'Add price version'}</h2><label>Model<input required className="ml-2 rounded border p-2" value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value })}/></label><label>Effective date<input required type="date" className="ml-2 rounded border p-2" value={draft.effective_date ?? ''} onChange={(event) => setDraft({ ...draft, effective_date: event.target.value })}/></label>{fields.map((field) => <label key={field}>{field.replace('_per_million', '').replaceAll('_', ' ')} per million<input required type="number" min="0" step="any" className="ml-2 rounded border p-2" value={draft[field] ?? 0} onChange={(event) => setDraft({ ...draft, [field]: Number(event.target.value) })}/></label>)}<button className="rounded bg-blue-700 p-2 text-white" disabled={create.isPending || update.isPending}>{editingId ? 'Update version' : 'Create version'}</button>{(create.isError || update.isError) && <p role="alert">Unable to save price version. Check for a duplicate or invalid version.</p>}</form>}
    {!!organizationId && !canEdit && role && <p className="mt-4 text-slate-600">Read-only: only organization owners and admins can edit prices.</p>}
  </section>;
}
