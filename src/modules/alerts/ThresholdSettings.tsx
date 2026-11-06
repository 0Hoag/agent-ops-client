import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AlertThresholdRequest } from '../../shared/api/generated/Api';
import { getAlertThresholds, updateAlertThresholds } from './services/client';
import { api } from '../../shared/api/client';
import { listMembers } from '../members/services/client';

const fields = [
  { key: 'min_cache_hit', label: 'Minimum cache-hit rate (%)', min: 0, max: 1 },
  { key: 'silent_seconds', label: 'Silent worker threshold (seconds)', min: 1, max: Number.MAX_SAFE_INTEGER },
  { key: 'pr_stale_seconds', label: 'Stale PR threshold (seconds)', min: 1, max: Number.MAX_SAFE_INTEGER },
] as const;

export function ThresholdSettings({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const [values, setValues] = useState<AlertThresholdRequest>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0);
  const [switching, setSwitching] = useState(false);
  const query = useQuery({ queryKey: ['alert-thresholds', organizationId, generation], queryFn: getAlertThresholds, enabled: !switching });
  const roleQuery = useQuery({ queryKey: ['alert-threshold-role', organizationId, version], queryFn: async () => {
    const session = await api.api.v1AuthSessionList();
    const accountId = session.data.account_id;
    if (!accountId) return '';
    const members = await listMembers(organizationId);
    return members.find((member) => member.account_id === accountId)?.role.toLowerCase() ?? '';
  }, enabled: !switching });
  useEffect(() => {
    const suspend = () => { setSwitching(true); setValues({}); setError(''); setSaved(false); setGeneration((value) => value + 1); };
    const resume = () => { setVersion((v) => v + 1); setSwitching(false); };
    window.addEventListener('organization:will-change', suspend);
    window.addEventListener('organization:changed', resume);
    return () => { window.removeEventListener('organization:will-change', suspend); window.removeEventListener('organization:changed', resume); };
  }, []);
  useEffect(() => { if (query.data && !switching) setValues(query.data); }, [query.data, switching]);
  const editable = ['owner', 'admin'].includes(roleQuery.data ?? '');
  const validate = () => fields.find(({ key, min, max }) => values[key] === undefined || !Number.isFinite(values[key]) || values[key]! < min || values[key]! > max);
  async function save() {
    const invalid = validate();
    if (invalid) { setError(`${invalid.label} must be between ${invalid.min} and ${invalid.max}.`); return; }
    const submitted = { ...values };
    setError(''); setSaved(false);
    try { await updateAlertThresholds(submitted); await queryClient.invalidateQueries({ queryKey: ['alert-thresholds', organizationId] }); setSaved(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save thresholds.'); }
  }
  return <section aria-label="Alert threshold settings" className="mb-6 border bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Alert thresholds</h2>
    {switching && <p role="status">Organization changing…</p>}
    {(query.isPending || roleQuery.isPending) && <p role="status">Loading thresholds…</p>}
    {roleQuery.isError && <p role="alert">Unable to verify organization permissions. <button onClick={() => void roleQuery.refetch()}>Retry</button></p>}
    {query.isError && <p role="alert">Unable to load thresholds: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {!query.isPending && !query.isError && !roleQuery.isPending && !roleQuery.isError && !switching && <>
      {fields.map(({ key, label, min, max }) => <label className="mb-3 grid gap-1" key={key}>{label}<input type="number" min={min} max={max} step="any" disabled={!editable} value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label>)}
      {!editable && <p>Read-only: owner or admin access required.</p>}
      {error && <p role="alert">{error}</p>}{saved && <p role="status">Thresholds saved.</p>}
      {editable && <button disabled={switching} onClick={() => void save()}>Save thresholds</button>}
    </>}
  </section>;
}
