import { cacheHitPercent, useRunAggregates } from './services/runs';
import type { AgentrunAggregate as RunAggregate } from '../../shared/api/generated/Api';
import { formatRunCost } from '../pricing/services/pricing';
import { useState } from 'react';

export function formatCost(value: number | undefined): string { return value === undefined ? 'Unknown' : `$${value.toFixed(4)}`; }
export function formatCacheHit(row: RunAggregate): string {
  const percentage = cacheHitPercent(row);
  return percentage === null ? 'N/A' : `${percentage.toFixed(1)}%`;
}

export function RunsPage() {
  const aggregates = useRunAggregates();
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD');
  return <section>
    <header className="mb-5"><h1 className="text-2xl font-semibold">Agent runs</h1><p className="text-sm text-slate-600">Token cache efficiency and known model cost by wave, worker, and issue</p></header>
    {aggregates.isPending && <p role="status" className="p-6">Loading runs…</p>}
    {aggregates.isError && <p role="alert" className="rounded bg-rose-50 p-4 text-rose-800">Unable to load runs: {aggregates.error.message}</p>}
    {aggregates.data && aggregates.data.length === 0 && <p className="rounded bg-white p-6 text-slate-600">No runs recorded.</p>}
    {aggregates.data && aggregates.data.length > 0 && <><label className="mb-3 block">Currency <select aria-label="Currency" className="ml-2 rounded border bg-white p-2" value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'VND')}><option>USD</option><option>VND</option></select></label><div className="overflow-x-auto rounded bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Wave', 'Worker', 'Issue', 'Runs', 'Cache hit', `Cost (${currency})`].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{aggregates.data.map((row, index) => <tr className="border-t" key={`${row.wave}-${row.worker}-${row.issue_number ?? 'all'}-${index}`}><td className="p-3">{row.wave}</td><td className="p-3">{row.worker}</td><td className="p-3">{row.issue_number === undefined ? '—' : `#${row.issue_number}`}</td><td className="p-3">{row.runs}</td><td className="p-3">{formatCacheHit(row)}</td><td className="p-3">{formatRunCost(row, currency)}</td></tr>)}</tbody></table></div></>}
  </section>;
}
