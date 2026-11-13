import type { InsightOverviewAttention } from '../../shared/api/generated/Api';

/** Keeps every attention record available without repeating the backlog on arrival. */
export function Attention({ items = [] }: { items?: InsightOverviewAttention[] }) {
  const groups = new Map<string, InsightOverviewAttention[]>();
  for (const item of items) {
    const kind = item.kind ?? 'other';
    groups.set(kind, [...(groups.get(kind) ?? []), item]);
  }
  // Actionable failures and missing prices come before inactive merge requests.
  const ordered = [...groups].sort(([a], [b]) => Number(a === 'stale_pr') - Number(b === 'stale_pr'));
  return <section aria-label="Needs attention" className="min-w-0 rounded border bg-white p-4">
    <h2 className="font-semibold">Needs attention</h2>
    {!items.length ? <p className="mt-3 text-sm text-slate-600">Nothing needs attention.</p> : <>
      <p className="mt-2 text-sm text-slate-600">{items.length} items · Review by category</p>
      {ordered.map(([kind, records]) => <details key={kind} className="mt-3 border-t pt-3">
        <summary className="cursor-pointer rounded py-1 focus-visible:outline focus-visible:outline-2">{records.length} {kind === 'stale_pr' ? `merge request${records.length === 1 ? '' : 's'} inactive for 3+ days` : kind === 'missing_price' ? `missing model price${records.length === 1 ? '' : 's'}` : kind === 'repeated_failures' ? 'repeated failures' : `other attention item${records.length === 1 ? '' : 's'}`}</summary>
        <ul className="mt-3 grid max-h-72 gap-3 overflow-y-auto text-sm">{records.map((item, index) => <li key={index} className="border-t pt-3">
          <p className="break-words">{item.message ?? 'Review this item'}{item.model ? ` · ${item.model}` : ''}</p>
          <p className="mt-1 flex flex-wrap gap-3">{item.run_id && <a className="text-blue-700 underline" href={`/runs/${encodeURIComponent(item.run_id)}`}>View run</a>}{item.pr_number && <span>PR #{item.pr_number}</span>}{item.model && <a className="text-blue-700 underline" href="/settings/advanced#model-prices">Set model prices</a>}</p>
        </li>)}</ul>
      </details>)}
    </>}
  </section>;
}
