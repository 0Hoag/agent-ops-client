import { useEffect, useRef, useState } from 'react';
import { useWork, useWorkDetail, useWorkRepositories } from './services';
import { SetupLinks } from '../../shared/ui/SetupLinks';
import { compact, money } from '../../shared/format';
import { ProductTerms, RelativeTime } from '../../shared/ui/ProductTerms';

/** Browse repository work and recorded session costs. */
export function WorkPage() {
  const params = new URLSearchParams(window.location.search);
  const [repository, setRepository] = useState(params.get('repository') ?? localStorage.getItem('agent-ops-repository') ?? '');
  const repositories = useWorkRepositories();
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ kind: string; number: number } | null>(() => {
    const number = Number(params.get('pr'));
    return Number.isSafeInteger(number) && number > 0 ? { kind: 'pr', number } : null;
  });
  const detailRegion = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const filters = { repository_id: repository, state: state || undefined, q: search || undefined, page };
  const query = useWork(filters);
  const detail = useWorkDetail(filters, selected?.kind ?? '', selected?.number ?? 0);
  const repositoryInfo = repositories.data?.find((item) => item.id === repository);
  const workUrl = detail.data?.item?.url || (selected && repositoryInfo?.provider === 'gitlab' && repositoryInfo.full_name ? `${(repositoryInfo.gitlab_base_url || 'https://gitlab.com').replace(/\/$/, '')}/${repositoryInfo.full_name}/-/${selected.kind === 'pr' ? 'merge_requests' : 'issues'}/${selected.number}` : '');
  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const current = meta?.page ?? page;
  const size = meta?.per_page;
  const total = meta?.total;
  const failed = items.filter((item) => ['failed', 'failure'].includes(item.ci_status ?? '')).length;
  const priced = items.filter((item) => item.cost_usd != null);
  const cost = priced.reduce((sum, item) => sum + item.cost_usd!, 0);
  const reset = () => { setPage(1); setSelected(null); };
  useEffect(() => {
    if (selected) {
      detailRegion.current?.focus();
      detailRegion.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [selected]);
  return <section className="readable-controls min-w-0">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Work</h1>
      <p className="text-slate-600">{query.data ? items.length ? `On this page: ${failed} work records with failing CI; ${priced.length ? `${money(cost)} recorded cost across ${priced.length} priced work records` : 'no recorded costs'}.${priced.length < items.length ? ' Other costs are unavailable; sync priced sessions.' : ''} Not repository-wide totals.` : 'No matching work to assess for attention or cost.' : 'Find work with failing CI and review its recorded session costs.'}</p></div>
      <label className="grid gap-1 text-sm">Repository<select aria-label="Repository" className="rounded border p-2" value={repository} onChange={(event) => { reset(); setRepository(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">Select repository</option>{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select></label>
    </header>
    <ProductTerms />
    {repositories.isError && <p role="alert">Unable to load repositories: {repositories.error.message} <button onClick={() => void repositories.refetch()}>Retry</button></p>}
    {!repository && <p className="mb-4 text-slate-600">Select a repository to view its work.</p>}
    {(!repository || query.data?.data?.length === 0) && <SetupLinks />}
    <div className="mb-4 flex flex-wrap gap-3"><label>Search<input aria-label="Search work" className="ml-2 rounded border p-2" value={search} onChange={(event) => { reset(); setSearch(event.target.value); }} /></label><label>Status<select aria-label="Status" className="ml-2 rounded border p-2" value={state} onChange={(event) => { reset(); setState(event.target.value); }}><option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="merged">Merged</option></select></label></div>
    {repository && query.isPending && <p role="status">Loading work…</p>}
    {query.isError && <p role="alert">Unable to load work: {query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data && <>
      <nav aria-label="Work pagination" className="mb-4 flex flex-wrap items-center gap-3">
        <p aria-live="polite">{total != null && size ? `${total ? (current - 1) * size + 1 : 0}–${Math.min((current - 1) * size + items.length, total)} of ${total} work records` : 'Work count unavailable'}</p>
        <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={current <= 1} onClick={() => { setSelected(null); setPage(current - 1); }}>Previous page</button>
        <span>Page {current}{total != null && size ? ` of ${Math.max(1, Math.ceil(total / size))}` : ''}</span>
        <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={total == null || !size || current * size >= total} onClick={() => { setSelected(null); setPage(current + 1); }}>Next page</button>
      </nav>
      {items.length ? <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-x-auto rounded border"><table className="responsive-table w-full text-left text-sm"><thead><tr className="border-b bg-slate-50">{['Work', 'Status / CI', 'Author', 'Age', 'Sessions', 'Cost'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
          {items.map((item, index) => <tr key={`${item.kind}-${item.number}-${index}`} aria-selected={selected?.kind === item.kind && selected?.number === item.number} className="work-row border-b">
            <td data-label="Work" className="p-3"><button className="text-left text-blue-700 underline" aria-controls="work-detail" aria-expanded={selected?.kind === item.kind && selected?.number === item.number} onClick={(event) => { if (item.kind && item.number) { trigger.current = event.currentTarget; setSelected({ kind: item.kind, number: item.number }); } }}>{item.title ?? `Work #${item.number ?? '—'}`}</button><p className="text-xs text-slate-500">{item.kind === 'pr' ? 'Merge request' : 'Issue'} #{item.number}</p></td>
            <td data-label="Status / CI" className="p-3">{item.state ?? '—'} / {item.ci_status ?? '—'}</td><td data-label="Author" className="p-3">{item.author ?? '—'}</td><td data-label="Age" className="p-3"><RelativeTime value={item.updated_at ?? item.created_at} /></td><td data-label="Sessions" className="p-3">{item.runs_count ?? '—'}</td><td data-label="Cost" className="p-3">{money(item.cost_usd)}</td>
          </tr>)}
        </tbody></table></div>
        <aside id="work-detail" ref={detailRegion} role="region" aria-label="Selected work details" tabIndex={-1} className={`min-w-0 scroll-mt-4 rounded border p-4 ${selected ? 'order-first lg:order-last' : ''}`}>
          {!selected ? <p className="text-slate-600">Select work to view session details.</p> : <>
            <button className="mb-3 text-blue-700 underline" onClick={() => { setSelected(null); trigger.current?.focus(); }}>Back to selected work</button>
            {detail.isPending ? <p role="status">Loading details…</p> : detail.isError ? <p role="alert">Unable to load details: {detail.error.message} <button onClick={() => void detail.refetch()}>Retry</button></p> : detail.data ? <>
              <h2 className="font-semibold">{detail.data.item?.title ?? `${selected.kind === 'pr' ? 'Merge request' : 'Issue'} #${selected.number}`}</h2>
              {workUrl && <a className="text-blue-700 underline" href={workUrl} target="_blank" rel="noreferrer">Open in GitLab</a>}
              <h3 className="mt-4 font-medium">Sessions</h3>{detail.data.runs?.length ? <ul className="mt-2 grid gap-3">{detail.data.runs.map((run, index) => <li key={run.id ?? index} className="border-t pt-2"><p>{run.model ?? 'Sync model name'}</p><p className="text-sm">{money(run.cost_usd)} USD · {compact(run.tokens)} tokens</p></li>)}</ul> : <p className="text-sm text-slate-600">No sessions. Sync agent sessions to link their costs.</p>}
            </> : null}
          </>}
        </aside>
      </div> : <p className="rounded border p-6 text-slate-600">No work found.</p>}
    </>}
  </section>;
}
