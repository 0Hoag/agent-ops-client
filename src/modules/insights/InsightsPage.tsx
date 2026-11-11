import { useState } from 'react';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { formatCycleTime, formatPercent, useInsights, useRepositories, useAnalytics, useDelivery, useInsightSession } from './services/insights';
import { CostCache, Delivery } from './AnalyticsTables';

export function InsightsPage() {
  const { session, switching, generation } = useInsightSession();
  if (switching || session.isPending) return <p role="status">Loading analytics session…</p>;
  if (session.isError || !session.data.organization_id) return <p role="alert">Unable to load analytics session. <button onClick={() => void session.refetch()}>Retry</button></p>;
  return <Dashboard key={`${generation}-${session.data.organization_id}`} organizationId={session.data.organization_id} />;
}

function Dashboard({ organizationId }: { organizationId: string }) {
  const repositories = useRepositories(organizationId);
  const [repositoryId, setRepositoryId] = useState('');
  const insights = useInsights(repositoryId, organizationId);
  const data = insights.data;
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [groupBy, setGroupBy] = useState<'harness' | 'model' | 'wave' | 'area'>('harness');
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const validDates = Boolean(from && to && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 < 366);
  const analytics = useAnalytics(organizationId, { repository_id: repositoryId || undefined, from, to, period, group_by: groupBy }, validDates);
  const delivery = useDelivery(organizationId, repositoryId, from, to, validDates);
  const complete = data?.history.complete ?? false;
  return <section>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Insights &amp; analytics</h1><p className="text-sm text-slate-600">Cost, cache and delivery measurements · USD</p></div><label className="grid gap-1 text-sm">Repository{repositories.isError ? <span role="alert" className="text-rose-700">Unable to load repositories: {repositories.error.message} <button onClick={() => void repositories.refetch()}>Retry</button></span> : <select aria-label="Repository" className="min-w-64 rounded border bg-white p-2" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} disabled={repositories.isPending || !repositories.data?.length}><option value="">All repositories (analytics)</option>{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select>}</label></header>
    <div className="mb-4 flex flex-wrap gap-3"><label>From (UTC) <input aria-label="From date" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To (UTC) <input aria-label="To date" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><label>Period <select aria-label="Period" value={period} onChange={(event) => setPeriod(event.target.value as 'daily' | 'weekly')}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label>Group by <select aria-label="Group by" value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}>{(['harness', 'model', 'wave', 'area'] as const).map((value) => <option key={value}>{value}</option>)}</select></label></div>
    {!validDates && <p role="alert">Choose an ordered UTC date range of at most 366 days.</p>}
    {analytics.isError && <p role="alert">Unable to load cost/cache analytics: {analytics.error.message} <button onClick={() => void analytics.refetch()}>Retry</button></p>}
    {validDates && analytics.isPending && <p role="status">Loading cost/cache analytics…</p>}
    {validDates && analytics.data && <CostCache data={analytics.data} />}
    {(repositories.data?.length === 0 || (validDates && analytics.data?.buckets?.length === 0)) && <SetupLinks />}
    {validDates && delivery.isPending && <p role="status">Loading delivery analytics…</p>}{delivery.isError && <p role="alert">Unable to load delivery analytics: {delivery.error.message} <button onClick={() => void delivery.refetch()}>Retry</button></p>}
    {validDates && delivery.data && <Delivery data={delivery.data} />}
    {repositories.isPending && <p role="status" className="p-6">Loading repositories…</p>}
    {!repositories.isPending && !repositories.isError && repositories.data && repositories.data.length === 0 && <p className="rounded bg-white p-6 text-slate-600">No repositories available.</p>}
    {repositoryId && insights.isPending && <p role="status" className="p-6">Loading insights…</p>}
    {repositoryId && insights.isError && <p role="alert" className="rounded bg-rose-50 p-4 text-rose-800">Unable to load insights: {insights.error.message} <button onClick={() => void insights.refetch()}>Retry</button></p>}
    {data && <>
      {!complete && <p role="note" className="mb-4 rounded bg-amber-50 p-3 text-amber-900">History is incomplete{data.history.reason ? `: ${data.history.reason}` : ''}. Metrics affected by missing history are unknown.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title="Send-back rate" value={formatPercent(data.send_back.rate, data.send_back.denominator, complete)} detail={`${data.send_back.numerator} send-backs / ${data.send_back.denominator} eligible`} />
        <Metric title="First-green CI" value={formatPercent(data.first_ci_success.rate, data.first_ci_success.eligible, complete)} detail={`${data.first_ci_success.successful} successful / ${data.first_ci_success.eligible} eligible`} />
        <Metric title="Issue cycle time" value={formatCycleTime(data.cycle_time.completed, data.cycle_time.median_seconds, complete)} detail={`${data.cycle_time.completed} completed issues`} />
      </div>
       <section className="mt-6 rounded bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Repeated-error suggestions</h2>{data.suggestions.length === 0 ? <p className="text-slate-600">No repeated-error suggestions.</p> : <ul className="grid gap-2">{data.suggestions.map((suggestion) => <li className="rounded border border-slate-200 p-3" key={suggestion.key}><p className="font-medium">{suggestion.message}</p><p className="text-sm text-slate-600">{suggestion.occurrences} occurrences</p><ul className="mt-2 text-xs text-slate-500">{suggestion.evidence.map((item) => <li key={item.delivery_id}>{item.event_type} · {item.received_at}{item.pr_number !== undefined ? ` · PR #${item.pr_number}` : ''}{item.issue_number !== undefined ? ` · issue #${item.issue_number}` : ''}</li>)}</ul></li>)}</ul>}</section>
    </>}
  </section>;
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded bg-white p-4"><h2 className="text-sm text-slate-600">{title}</h2><p className="my-2 text-2xl font-semibold">{value}</p><p className="text-xs text-slate-500">{detail}</p></article>;
}
