import { useState } from 'react';
import type { AgentrunAgentRun, AgentrunRunStep } from '../../shared/api/generated/Api';
import { useRunAggregates, useRuns, useRunTimeline } from './services/runs';
import { formatCacheHit, formatRunCost } from './run-format';

function RunDetail({ run }: { run: AgentrunAgentRun }) {
  const timeline = useRunTimeline(run.id ?? '');
  if (!run.id) return <p role="alert">Run identity unavailable; timeline cannot be loaded.</p>;
  if (timeline.isPending) return <p role="status">Loading timeline…</p>;
  if (timeline.isError) return <p role="alert">Unable to load timeline: {timeline.error.message}</p>;
  if (!timeline.data?.length) return <p>No timeline steps recorded.</p>;
  const steps = [...timeline.data].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  return <section aria-label="Run timeline" className="mt-5"><h2 className="text-xl font-semibold">Timeline ({steps.length} steps)</h2><ol className="mt-3 space-y-2">{steps.map((step, index) => <TimelineStep key={step.id ?? step.sequence ?? index} step={step} index={index} />)}</ol></section>;
}

function TimelineStep({ step, index }: { step: AgentrunRunStep; index: number }) {
  return <li className="rounded border bg-white p-3"><strong>Step {step.sequence ?? index + 1}</strong>{step.tool_name && <span className="ml-3">Tool: {step.tool_name}</span>}<span className="ml-3">Input {step.input_tokens ?? '—'} · Cached {step.cached_input_tokens ?? '—'} · Cache write {step.cache_write_tokens ?? '—'} · Output {step.output_tokens ?? '—'} · Reasoning {step.reasoning_tokens ?? '—'}</span><span className="ml-3">Cache {step.cache_hit === undefined ? 'Unknown' : step.cache_hit ? 'hit' : 'miss'}</span><span className="ml-3">Cumulative cost {step.cumulative_cost_usd === undefined ? 'Unknown' : `$${step.cumulative_cost_usd.toFixed(4)}`}</span></li>;
}

export function RunsPage() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search));
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD');
  const runId = params.get('run');
  const filters = { repository_id: params.get('repository_id') || undefined, wave: params.get('wave') || undefined, harness: params.get('harness') || undefined, model: params.get('model') || undefined, issue_number: numberParam(params, 'issue_number'), pr_number: numberParam(params, 'pr_number'), started_after: params.get('started_after') || undefined, started_before: params.get('started_before') || undefined, page: numberParam(params, 'page') ?? 1, per_page: numberParam(params, 'per_page') ?? 20 };
  const runs = useRuns(filters);
  const aggregates = useRunAggregates({ repository_id: filters.repository_id, wave: filters.wave });
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete('page'); const query = next.toString(); window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`); setParams(next); };
  const selected = runs.data?.data.find((run) => run.id === runId);
  return <section className="space-y-5">
    <header><h1 className="text-2xl font-semibold">Agent runs</h1><p className="text-sm text-slate-600">Filter runs and inspect their token, tool, cache, and cost timeline.</p></header>
    <div className="grid gap-3 md:grid-cols-4">{[['Repository', 'repository_id'], ['Wave', 'wave'], ['Harness', 'harness'], ['Model', 'model'], ['Issue', 'issue_number'], ['Pull request', 'pr_number'], ['Started after', 'started_after'], ['Started before', 'started_before']].map(([label, key]) => <label key={key} className="text-sm">{label}<input aria-label={label} className="ml-2 rounded border p-2" value={params.get(key) ?? ''} onChange={(event) => update(key, event.target.value)} /></label>)}</div>
    {runs.isPending && <p role="status" className="p-6">Loading runs…</p>}
    {runs.isError && <p role="alert" className="rounded bg-rose-50 p-4 text-rose-800">Unable to load runs: {runs.error.message}</p>}
    {runs.data && runs.data.data.length === 0 && <p className="rounded bg-white p-6 text-slate-600">No runs recorded.</p>}
    {runs.data && runs.data.data.length > 0 && <><p>Page {runs.data.meta.page} · {runs.data.meta.total} runs</p><div className="overflow-x-auto rounded bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Run', 'Wave', 'Harness', 'Model', 'Issue', 'Pull request', 'CI', 'Started'].map((heading) => <th className="p-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{runs.data.data.map((run) => <tr className="border-t" key={run.id}><td className="p-3"><button className="text-blue-700 underline" onClick={() => update('run', run.id ?? '')}>{run.id}</button></td><td className="p-3">{run.wave ?? '—'}</td><td className="p-3">{run.harness ?? '—'}</td><td className="p-3">{run.model ?? '—'}</td><td className="p-3">{(run.relations?.issues ?? []).map((issue) => <a key={issue.number} className="mr-2 text-blue-700 underline" href={`https://github.com/${issue.repository_id}/issues/${issue.number}`}>#{issue.number} {issue.title}</a>)}</td><td className="p-3">{(run.relations?.pull_requests ?? []).map((pr) => <a key={pr.number} className="mr-2 text-blue-700 underline" href={`https://github.com/${pr.repository_id}/pull/${pr.number}`}>#{pr.number} {pr.title}</a>)}</td><td className="p-3">{(run.relations?.ci ?? []).map((ci) => <span key={`${ci.external_id}-${ci.sha}`}>{ci.status ?? 'Unknown'} · {ci.conclusion ?? 'Unknown'}</span>)}</td><td className="p-3">{run.started_at ?? '—'}</td></tr>)}</tbody></table></div><div className="flex gap-3"><button disabled={runs.data.meta.page <= 1} onClick={() => update('page', String(runs.data!.meta.page - 1))}>Previous</button><button disabled={runs.data.meta.page * runs.data.meta.per_page >= runs.data.meta.total} onClick={() => update('page', String(runs.data!.meta.page + 1))}>Next</button></div></>}
     {selected && <><h2 className="text-xl font-semibold">Run {selected.id}</h2><RunDetail run={selected} /></>}
    {aggregates.isError && <p role="alert">Unable to load run aggregates: {aggregates.error.message}</p>}
    {aggregates.data && aggregates.data.length > 0 && <details><summary>Run aggregates</summary><label>Currency <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'VND')}><option>USD</option><option>VND</option></select></label><table><thead><tr>{['Wave', 'Worker', 'Issue', 'Runs', 'Cache hit', `Cost (${currency})`].map((heading) => <th className="p-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{aggregates.data.map((row, index) => <tr key={`${row.wave}-${row.worker}-${index}`}><td>{row.wave}</td><td>{row.worker}</td><td>{row.issue_number ?? '—'}</td><td>{row.runs}</td><td>{formatCacheHit(row)}</td><td>{formatRunCost(row, currency)}</td></tr>)}</tbody></table></details>}
  </section>;
}

function numberParam(params: URLSearchParams, key: string): number | undefined { const value = params.get(key); return value && Number.isFinite(Number(value)) ? Number(value) : undefined; }
