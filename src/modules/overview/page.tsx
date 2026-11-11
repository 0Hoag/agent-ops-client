import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useDailySpend, useOverview } from './services';
import { Checklist } from './Checklist';

type Preset = 'Today' | '7 days' | '30 days';
function range(preset: Preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset !== 'Today') start.setDate(start.getDate() - (preset === '7 days' ? 6 : 29));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
function money(value?: number) { return value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value); }
function metric(current?: number, previous?: number, format: (value?: number) => string = (value) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`) {
  if (current === undefined) return { value: '—', change: 'Previous period unavailable' };
  if (previous === undefined) return { value: format(current), change: 'Previous period unavailable' };
  const delta = current - previous;
  return { value: format(current), change: `${delta > 0 ? '+' : ''}${format(delta)} vs previous period` };
}

export function OverviewPage() {
  const [preset, setPreset] = useState<Preset>('7 days');
  const [repo, setRepo] = useState(localStorage.getItem('agent-ops-repository') ?? '');
  const [dates, setDates] = useState(() => range('7 days'));
  const [generation, setGeneration] = useState(0);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    const suspend = () => setSwitching(true);
    const changed = () => { setGeneration((value) => value + 1); setSwitching(false); };
    window.addEventListener('organization:will-change', suspend);
    window.addEventListener('organization:changed', changed);
    window.addEventListener('auth:unauthorized', suspend);
    return () => { window.removeEventListener('organization:will-change', suspend); window.removeEventListener('organization:changed', changed); window.removeEventListener('auth:unauthorized', suspend); };
  }, []);
  const session = useQuery({ queryKey: ['overview-session', generation], queryFn: async () => (await api.api.v1AuthSessionList()).data, enabled: !switching });
  const organizationId = session.data?.organization_id ?? '';
  const repositories = useQuery({ queryKey: ['overview-repositories', organizationId, generation], queryFn: async () => (await api.api.v1RepositoriesList()).data.data ?? [], enabled: Boolean(organizationId) });
  const filters = { ...dates, repository_id: repo || undefined };
  const query = useOverview(organizationId, filters);
  const daily = useDailySpend(organizationId, filters);
  const current = query.data?.current;
  const previous = query.data?.previous;
  const series = daily.data?.buckets ?? [];
  const max = Math.max(0, ...series.map((item) => Number(item.actual_cost_usd ?? 0)));
  if (switching) return <p role="status">Loading overview session…</p>;
  return <section className="min-w-0">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Overview</h1><p className="mt-1 text-slate-600">{current?.spend_usd === undefined ? 'Spend unavailable' : `${money(current.spend_usd)} spent`}{current?.cache_savings_usd !== undefined ? ` · ${money(current.cache_savings_usd)} saved with cache` : ''}</p></div><label className="grid gap-1 text-sm">Repository<select aria-label="Repository" className="rounded border bg-white p-2" value={repo} onChange={(event) => { setRepo(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">All repositories</option>{(repositories.data ?? []).filter((item) => item.id && item.full_name).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label></header>
    {session.isError && <p role="alert">Unable to load session: {session.error.message} <button onClick={() => void session.refetch()}>Retry</button></p>}
    {session.isPending && <p role="status">Loading overview…</p>}
    {organizationId && <Checklist key={`${organizationId}-${generation}`} organizationId={organizationId} />}
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Date range presets">{(['Today', '7 days', '30 days'] as const).map((item) => <button key={item} aria-pressed={preset === item} className="rounded border px-3 py-2" onClick={() => { setPreset(item); setDates(range(item)); }}>{item}</button>)}</div>
    {query.isPending && <p role="status">Loading overview data…</p>}{query.isError && <p role="alert">Unable to load overview: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data && <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card title="Spend" value={metric(current?.spend_usd, previous?.spend_usd, money)} /><Card title="Cost per merged PR" value={metric(current?.cost_per_merged_pr, previous?.cost_per_merged_pr, money)} /><Card title="Cache hit rate" value={metric(current?.cache_hit_rate, previous?.cache_hit_rate)} /><Card title="Rework rate" value={metric(current?.rework_rate, previous?.rework_rate)} /></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3"><section className="min-w-0 rounded border bg-white p-4 lg:col-span-2"><h2 className="font-semibold">Spend by day</h2>{daily.isPending && <p role="status">Loading daily spend…</p>}{daily.isError && <p role="alert">Unable to load daily spend: {daily.error.message} <button onClick={() => void daily.refetch()}>Retry</button></p>}{daily.data && (series.length ? <div className="mt-4 flex h-48 items-end gap-1" aria-label="Daily spend chart">{series.map((item) => { const spend = Number(item.actual_cost_usd ?? 0); return <div className="flex min-w-0 flex-1 flex-col items-center justify-end" key={item.start}><span className="text-xs">{money(spend)}</span><div className="w-full bg-blue-600" title={`${item.start ?? ''}: ${money(spend)}`} style={{ height: `${max ? Math.max(2, spend / max * 100) : 2}%` }} /><time className="mt-1 truncate text-xs">{item.start?.slice(0, 10) ?? '—'}</time></div>; })}</div> : <p className="mt-3 text-sm text-slate-600">No daily spend data for this period.</p>)}</section>
      <section className="rounded border bg-white p-4"><h2 className="font-semibold">Needs attention</h2>{query.data.attention?.length ? <ul className="mt-3 grid gap-3">{query.data.attention.map((item, index) => <li key={`${item.run_id ?? ''}-${item.pr_number ?? ''}-${index}`} className="border-t pt-3"><p>{item.message ?? 'Attention item'}</p><p className="mt-1 flex flex-wrap gap-3 text-sm">{item.run_id && <a className="text-blue-700 underline" href={`/runs/${encodeURIComponent(item.run_id)}`}>View run</a>}{item.repository_id && item.pr_number && <span>PR #{item.pr_number}</span>}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Nothing needs attention.</p>}</section></div>
      {!current && <p className="mt-4 text-slate-600">No overview data for this period.</p>}
    </>}
  </section>;
}

function Card({ title, value }: { title: string; value: { value: string; change: string } }) {
  return <article className="min-w-0 rounded border bg-white p-4"><h2 className="text-sm text-slate-600">{title}</h2><p className="my-2 text-2xl font-semibold">{value.value}</p><p className="text-xs text-slate-500">{value.change}</p></article>;
}
