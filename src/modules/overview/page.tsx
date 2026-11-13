import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useDailySpend, useOverview } from './services';
import { Checklist } from './Checklist';
import { money } from '../../shared/format';
import { ProductTerms } from '../../shared/ui/ProductTerms';
import { Attention } from './Attention';
import { DailySpend } from './DailySpend';

type Preset = 'Today' | '7 days' | '30 days';
function range(preset: Preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset !== 'Today') start.setDate(start.getDate() - (preset === '7 days' ? 6 : 29));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
function metric(current?: number | null, previous?: number | null, format?: (value?: number) => string) {
  const display = format ?? ((value?: number) => `${(value! * 100).toFixed(1)}%`);
  if (current == null) return { value: 'Sync usage and delivery history', change: 'Check model pricing in Settings' };
  if (previous == null) return { value: display(current), change: 'Previous period unavailable' };
  const delta = current - previous;
  return { value: display(current), change: `${delta > 0 ? '+' : ''}${format ? format(delta) : `${(delta * 100).toFixed(1)} percentage points`} vs previous period` };
}

/** Organization-scoped spend evidence and progressively disclosed attention. */
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
  const missing = current?.models_without_price ?? [];
  const partial = missing.length > 0;
  const partialComparison = partial || Boolean(previous?.models_without_price?.length);
  if (switching) return <p role="status">Loading overview session…</p>;
  return <section className="min-w-0">
    <ProductTerms />
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><h1 className="text-2xl font-semibold">Overview</h1><section aria-label="Spend summary" className="mt-1 text-slate-600"><p>{current?.spend_usd == null ? 'Spend unavailable' : `${money(current.spend_usd)} ${partial ? 'priced subtotal · Partial spend' : 'spent'}`}{current?.cache_savings_usd != null ? ` · ${money(current.cache_savings_usd)} saved with cache${partial ? ' (priced usage only)' : ''}` : ''}</p>{partial && <p className="mt-2 break-words text-sm">Excludes unpriced usage: {missing.join(', ')}. <a className="text-blue-700 underline" href="/settings/advanced#model-prices">Set model prices</a></p>}</section></div><label className="grid gap-1 text-sm">Repository<select aria-label="Repository" className="rounded border bg-white p-2" value={repo} onChange={(event) => { setRepo(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">All repositories</option>{(repositories.data ?? []).filter((item) => item.id && item.full_name).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label></header>
    {session.isError && <p role="alert">Unable to load session: {session.error.message} <button onClick={() => void session.refetch()}>Retry</button></p>}
    {session.isPending && <p role="status">Loading overview…</p>}
    {organizationId && <Checklist key={`${organizationId}-${generation}`} organizationId={organizationId} />}
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Date range presets">{(['Today', '7 days', '30 days'] as const).map((item) => <button key={item} aria-pressed={preset === item} className="rounded border px-3 py-2" onClick={() => { setPreset(item); setDates(range(item)); }}>{item}</button>)}</div>
    {query.isPending && <p role="status">Loading overview data…</p>}{query.isError && <p role="alert">Unable to load overview: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data && <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card title={partial ? 'Spend · Partial' : 'Spend'} value={{ ...metric(current?.spend_usd, previous?.spend_usd, money), ...(partialComparison ? { change: 'Priced usage only · Set missing model prices before comparing periods' } : {}) }} /><Card title={partial ? 'Cost per merged PR · Partial' : 'Cost per merged PR'} value={{ ...metric(current?.cost_per_merged_pr, previous?.cost_per_merged_pr, money), ...(partialComparison ? { change: 'Priced usage only · Set missing model prices before comparing periods' } : {}) }} /><Card title="Cache hit rate" value={metric(current?.cache_hit_rate, previous?.cache_hit_rate)} /><Card title="Rework rate" value={metric(current?.rework_rate, previous?.rework_rate)} /></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3"><section className="min-w-0 rounded border bg-white p-4 lg:col-span-2"><h2 className="font-semibold">Spend by day{partial ? ' · Priced usage only' : ''}</h2>{daily.isPending && <p role="status">Loading daily spend…</p>}{daily.isError && <p role="alert">Unable to load daily spend: {daily.error.message} <button onClick={() => void daily.refetch()}>Retry</button></p>}{daily.data && (series.length ? <DailySpend buckets={series} /> : <p className="mt-3 text-sm text-slate-600">No daily spend data for this period.</p>)}</section>
      <Attention items={query.data.attention} /></div>
      {!current && <p className="mt-4 text-slate-600">No overview data for this period.</p>}
    </>}
  </section>;
}

function Card({ title, value }: { title: string; value: { value: string; change: string } }) {
  return <article className="min-w-0 rounded border bg-white p-4"><h2 className="text-sm text-slate-600">{title}</h2><p className="my-2 text-2xl font-semibold">{value.value}</p><p className="text-xs text-slate-500">{value.change}</p></article>;
}
