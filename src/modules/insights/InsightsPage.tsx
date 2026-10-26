import { useState } from 'react';
import { formatCycleTime, formatPercent, useInsights, useRepositories } from './services/insights';

export function InsightsPage() {
  const repositories = useRepositories();
  const [repositoryId, setRepositoryId] = useState('');
  const insights = useInsights(repositoryId);
  const data = insights.data;
  const complete = data?.history.complete ?? false;
  return <section>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Insights</h1><p className="text-sm text-slate-600">Delivery quality, first-green CI, cycle time, and repeated errors</p></div><label className="grid gap-1 text-sm">Repository{repositories.isError ? <span role="alert" className="text-rose-700">Unable to load repositories: {repositories.error.message}</span> : <select aria-label="Repository" className="min-w-64 rounded border bg-white p-2" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} disabled={repositories.isPending || !repositories.data?.length}><option value="">Select a repository</option>{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select>}</label></header>
    {repositories.isPending && <p role="status" className="p-6">Loading repositories…</p>}
    {!repositories.isPending && !repositories.isError && repositories.data && repositories.data.length === 0 && <p className="rounded bg-white p-6 text-slate-600">No repositories available.</p>}
    {repositoryId && insights.isPending && <p role="status" className="p-6">Loading insights…</p>}
    {repositoryId && insights.isError && <p role="alert" className="rounded bg-rose-50 p-4 text-rose-800">Unable to load insights: {insights.error.message}</p>}
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
