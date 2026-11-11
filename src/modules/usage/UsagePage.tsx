import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card, DateRangePicker, Select } from '../../shared/ui';
import { dateRange, useUsage, useUsageSession } from './services';
import { dailyCosts, groupCosts, money, sum } from './format';
import { CostList, MergeRequests, Sessions } from './Evidence';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { ProductTerms } from '../../shared/ui/ProductTerms';

function State({ query, name }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown }; name: string }) {
  return query.isError ? <p role="alert">Unable to load {name}. Check your connection. <button onClick={() => void query.refetch()}>Retry</button></p> : query.isPending ? <p role="status">Loading {name}…</p> : null;
}
function Panel({ title, children }: { title: string; children: ReactNode }) { return <Card><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</Card>; }
export function UsagePage() {
  const { session, switching, generation } = useUsageSession();
  if (switching || session.isPending) return <p role="status">Loading usage session…</p>;
  if (session.isError || !session.data.organization_id) return <p role="alert">Unable to load usage session. <button onClick={() => void session.refetch()}>Retry</button></p>;
  return <Dashboard key={`${generation}-${session.data.organization_id}`} organizationId={session.data.organization_id} />;
}
function Dashboard({ organizationId }: { organizationId: string }) {
  const [preset, setPreset] = useState('7 days');
  const [dates, setDates] = useState(() => dateRange('7 days'));
  const [repository, setRepository] = useState('');
  const [split, setSplit] = useState('Model');
  const valid = Boolean(dates.from && dates.to && dates.from <= dates.to && (Date.parse(dates.to) - Date.parse(dates.from)) / 86400000 < 366);
  const { repositories, runs, analytics, overview } = useUsage(organizationId, { ...dates, repository_id: repository || undefined }, valid);
  const repositoryName = (id?: string) => repositories.data?.find((repo) => repo.id === id)?.full_name || 'Repository name unavailable';
  const daily = dailyCosts(analytics.data?.buckets ?? []);
  const total = analytics.data?.unknown_price_count ? undefined : sum(daily.map((row) => row.cost));
  const splits = groupCosts(runs.data ?? [], (run) => split === 'Model' ? run.model || 'Model not reported' : split === 'Tool' ? run.harness || 'Tool not reported' : repositoryName(run.repository_id), (run) => run.cost_usd);
  return <section className="min-w-0 space-y-5" style={{ color: 'var(--text)' }}>
    <ProductTerms />
    <header><h1 className="text-2xl font-semibold">Usage</h1><p className="mt-2">{analytics.data ? total === undefined ? 'Spend unavailable — sync usage and configure model prices in Settings' : `${money(total)} spent` : 'Spend over time, session costs and cache savings'} · USD</p></header>
    <div className="flex min-w-0 flex-wrap gap-3">
      <label className="grid min-w-0 gap-1">Date range<DateRangePicker value={preset} onChange={(event) => { setPreset(event.target.value); if (event.target.value !== 'Custom') setDates(dateRange(event.target.value)); }} /></label>
      <label className="grid min-w-0 gap-1">Usage repository<Select aria-label="Usage repository" style={{ maxWidth: '100%' }} value={repository} onChange={(event) => setRepository(event.target.value)}><option value="">All repositories</option>{repositories.data?.filter((repo) => repo.id && repo.full_name).map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</Select></label>
      {preset === 'Custom' && <><label>From (UTC)<input aria-label="From date" type="date" value={dates.from} onChange={(event) => setDates({ ...dates, from: event.target.value })} /></label><label>To (UTC)<input aria-label="To date" type="date" value={dates.to} onChange={(event) => setDates({ ...dates, to: event.target.value })} /></label></>}
    </div>
    <State query={repositories} name="repositories" />
    {!valid ? <p role="alert">Choose an ordered date range of at most 366 days.</p> : <>
      <Panel title="Spend by day"><State query={analytics} name="daily spend" />{analytics.data && (daily.length ? <CostList rows={daily.map((row) => ({ ...row, name: row.name === 'Date unavailable' ? row.name : new Date(`${row.name}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }))} /> : <Empty />)}</Panel>
      <Panel title="Cache savings"><State query={overview} name="cache savings" />{overview.data && <p>{overview.data.current?.cache_savings_usd === undefined ? 'Savings unavailable. Sync token usage and configure cache prices in Settings.' : `${money(overview.data.current.cache_savings_usd)} saved with cache`}</p>}</Panel>
      <State query={runs} name="sessions" />
      {runs.data && (runs.data.length ? <>
        <Panel title="Spend split"><label className="mb-4 grid gap-1">Split by<Select aria-label="Split by" value={split} onChange={(event) => setSplit(event.target.value)}>{['Model', 'Tool', 'Repository'].map((item) => <option key={item}>{item}</option>)}</Select></label><CostList rows={splits} /></Panel>
        <Panel title="Top five expensive merge requests"><MergeRequests runs={runs.data} repositoryName={repositoryName} /></Panel>
        <Panel title="Sessions"><Sessions runs={runs.data} /></Panel>
      </> : <Empty />)}
    </>}
  </section>;
}
function Empty() { return <div><p>No usage in this period. Choose a wider date range or complete setup.</p><SetupLinks /></div>; }
