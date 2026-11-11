import { useSearchParams } from 'react-router-dom';
import { Card } from '../../shared/ui';
import { mergeRequestUrl, money, readable, relative, total } from './format';
import { useRepositories, useSession, useSessionOrganization } from './services';
import { Timeline } from './Timeline';

export function SessionPage() {
  const { session, switching, generation } = useSessionOrganization();
  if (switching || session.isPending) return <p role="status">Loading session…</p>;
  if (session.isError || !session.data.organization_id) return <p role="alert">Unable to verify organization. <button onClick={() => void session.refetch()}>Retry</button></p>;
  return <Detail key={`${generation}-${session.data.organization_id}`} organizationId={session.data.organization_id} />;
}
function Detail({ organizationId }: { organizationId: string }) {
  const [params] = useSearchParams();
  const runId = params.get('run') || '';
  const query = useSession(organizationId, runId, params.get('repository') || undefined);
  const repositories = useRepositories(organizationId);
  if (!runId) return <p>Select a session from <a href="/usage" className="underline">Usage</a> to inspect its cost.</p>;
  if (query.isError) return <p role="alert">Unable to load session. Check your connection. <button onClick={() => void query.refetch()}>Retry</button></p>;
  if (query.isPending) return <p role="status">Loading session costs…</p>;
  if (!query.data.length) return <p>This session is not available in the current organization. <a href="/usage" className="underline">Choose a session in Usage</a>.</p>;
  const runs = query.data;
  const first = runs[0];
  const links = new Map<string, { repositoryId?: string; number: number }>();
  runs.forEach((run) => {
    if (run.pr_number) links.set(`${run.repository_id}-${run.pr_number}`, { repositoryId: run.repository_id, number: run.pr_number });
    run.relations?.pull_requests?.forEach((pr) => { if (pr.number) links.set(`${pr.repository_id ?? run.repository_id}-${pr.number}`, { repositoryId: pr.repository_id ?? run.repository_id, number: pr.number }); });
  });
  return <section className="min-w-0 space-y-5" style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>
    <header><h1 className="text-2xl font-semibold">Session detail</h1><p className="mt-2 text-xl">{money(total(runs.map((run) => run.cost_usd)))} · USD</p><p>Actual recorded cost across {runs.length} {runs.length === 1 ? 'run' : 'runs'} in this session; not an estimate.</p></header>
    <a href="/usage" className="underline">Back to Usage</a>
    <Card><p>{readable(first.harness, 'Sync tool name')} · {readable(first.branch, 'Sync branch name')} · <time title={first.started_at && Number.isFinite(Date.parse(first.started_at)) ? new Date(first.started_at).toLocaleString() : undefined}>{relative(first.started_at)}</time></p>
      <h2 className="mt-3 font-semibold">Linked merge requests</h2>
      {repositories.isPending && <p role="status">Loading repository metadata…</p>}
      {repositories.isError && <p role="alert">Unable to load repository metadata. <button onClick={() => void repositories.refetch()}>Retry</button></p>}
      {!links.size && <p>Link this session to a merge request in your tool telemetry, then sync it.</p>}
      {[...links].map(([key, link]) => {
        const repo = repositories.data?.find((row) => row.id === link.repositoryId);
        const url = mergeRequestUrl(repo, link.number);
        return <p key={key}>{url ? <a className="underline" href={url} target="_blank" rel="noreferrer">{readable(repo?.full_name, 'Repository')} · MR #{link.number}</a> : `MR #${link.number} — sync repository provider and URL in Settings to enable this link.`}</p>;
      })}
    </Card>
    <h2 className="text-lg font-semibold">Time, tools, tokens and cache trend</h2>
    {runs.map((run, index) => <section className="space-y-3" key={run.id ?? index}><h3>{readable(run.model, 'Sync model name')} · {readable(run.harness, 'Sync tool name')} · {money(run.cost_usd)}</h3><Timeline organizationId={organizationId} runId={run.id} /></section>)}
  </section>;
}
