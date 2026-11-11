import { useState } from 'react';
import { useWork, useWorkDetail, useWorkRepositories } from './services';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { compact, money } from '../../shared/format';
import { ProductTerms, RelativeTime } from '../../shared/ui/ProductTerms';

const age = (value?: string) => <RelativeTime value={value} />;

export function WorkPage() {
  const [repository, setRepository] = useState(localStorage.getItem('agent-ops-repository') ?? '');
  const repositories = useWorkRepositories();
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ kind: string; number: number } | null>(null);
  const filters = { repository_id: repository, state: state || undefined, q: search || undefined };
  const query = useWork(filters);
  const detail = useWorkDetail(filters, selected?.kind ?? '', selected?.number ?? 0);
  return <section className="min-w-0">
    <ProductTerms />
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Work</h1><p className="text-slate-600">Merge requests and issues</p></div><label className="grid gap-1 text-sm">Repository<select aria-label="Repository" className="rounded border p-2" value={repository} onChange={(event) => { setRepository(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">Select repository</option>{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select></label></header>
    {repositories.isError && <p role="alert">Unable to load repositories: {repositories.error.message} <button onClick={() => void repositories.refetch()}>Retry</button></p>}
    {!repository && <p className="mb-4 text-slate-600">Select a repository to view its work.</p>}
    {(!repository || query.data?.data?.length === 0) && <SetupLinks />}
    <div className="mb-4 flex flex-wrap gap-3"><label>Search<input aria-label="Search work" className="ml-2 rounded border p-2" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Status<select aria-label="Status" className="ml-2 rounded border p-2" value={state} onChange={(event) => setState(event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="merged">Merged</option></select></label></div>
    {repository && query.isPending && <p role="status">Loading work…</p>}{query.isError && <p role="alert">Unable to load work: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data && (query.data.data?.length ? <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-w-0 overflow-x-auto rounded border"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Work</th><th className="p-3">Status / CI</th><th className="p-3">Author</th><th className="p-3">Age</th><th className="p-3">Runs</th><th className="p-3">Cost</th></tr></thead><tbody>{query.data.data.map((item, index) => <tr key={`${item.kind}-${item.number}-${index}`} className="cursor-pointer border-b hover:bg-slate-50" onClick={() => item.kind && item.number && setSelected({ kind: item.kind, number: item.number })}><td className="p-3"><button className="text-left text-blue-700 underline" onClick={() => item.kind && item.number && setSelected({ kind: item.kind, number: item.number })}>{item.title ?? `${item.kind ?? 'Work'} #${item.number ?? '—'}`}</button><p className="text-xs text-slate-500">{item.kind} #{item.number}</p></td><td className="p-3">{item.state ?? '—'} / {item.ci_status ?? '—'}</td><td className="p-3">{item.author ?? '—'}</td><td className="p-3">{age(item.updated_at ?? item.created_at)}</td><td className="p-3">{item.runs_count ?? '—'}</td><td className="p-3">{money(item.cost_usd)}</td></tr>)}</tbody></table></div>
      <aside className="min-w-0 rounded border p-4">{!selected ? <p className="text-slate-600">Select work to view run details.</p> : detail.isPending ? <p role="status">Loading details…</p> : detail.isError ? <p role="alert">Unable to load details: {detail.error.message}</p> : detail.data ? <><h2 className="font-semibold">{detail.data.item?.title ?? `${selected.kind} #${selected.number}`}</h2>{detail.data.item?.url && <a className="text-blue-700 underline" href={detail.data.item.url} target="_blank" rel="noreferrer">Open in GitLab</a>}<h3 className="mt-4 font-medium">Runs</h3>{detail.data.runs?.length ? <ul className="mt-2 grid gap-3">{detail.data.runs.map((run, index) => <li key={run.id ?? index} className="border-t pt-2"><p>{run.model ?? 'Sync model name'}</p><p className="text-sm">{money(run.cost_usd)} USD · {compact(run.tokens)} tokens</p></li>)}</ul> : <p className="text-sm text-slate-600">No runs. Sync agent sessions to link their costs.</p>}</> : null}</aside></div> : <p className="rounded border p-6 text-slate-600">No work found.</p>)}
  </section>;
}
