import type { AgentrunAgentRun } from '../../shared/api/generated/Api';
import { groupCosts, money, sessionName, sessionRows, tokens } from './format';
import { exactTime } from '../../shared/format';

export function CostList({ rows }: { rows: { name: string; cost?: number; href?: string }[] }) {
  const max = Math.max(0, ...rows.map((row) => row.cost ?? 0));
  return <><ul className="grid gap-3">{rows.map((row) => <li key={row.name} className="min-w-0"><div className="flex flex-wrap justify-between gap-2"><span className="break-all">{row.href ? <a className="underline" href={row.href}>{row.name}</a> : row.name}</span><span>{money(row.cost)}</span></div>{row.cost !== undefined && <div aria-hidden="true" style={{ height: 4, width: `${max ? row.cost / max * 100 : 0}%`, background: 'var(--accent)', marginTop: 4 }} />}</li>)}</ul>{rows.some((row) => row.cost === undefined) && <p className="mt-3"><a className="underline" href="/settings/advanced#model-prices">Set model prices</a>. If recorded cost is missing, sync session cost telemetry; pricing alone does not supply a recorded cost.</p>}</>;
}
export function MergeRequests({ runs, repositoryName }: { runs: AgentrunAgentRun[]; repositoryName: (id?: string) => string }) {
  const rows = groupCosts(runs.filter((run) => run.pr_number), (run) => `${repositoryName(run.repository_id)} · MR #${run.pr_number}`, (run) => run.cost_usd);
  const top = rows.filter((row) => row.cost !== undefined).sort((a, b) => b.cost! - a.cost!).slice(0, 5).map((row) => {
    const run = runs.find((item) => `${repositoryName(item.repository_id)} · MR #${item.pr_number}` === row.name);
    return { ...row, href: run?.repository_id ? `/work?${new URLSearchParams({ repository: run.repository_id, pr: String(run.pr_number) })}` : undefined };
  });
  return <><p className="mb-3 text-sm">Attributed session costs in this period; includes open and closed merge requests.</p>{top.length ? <CostList rows={top} /> : <p>No priced merge requests. Link sessions to a merge request and sync recorded session costs.</p>}{rows.some((row) => row.cost === undefined) && <p>Some merge requests cannot be ranked: recorded costs are unavailable. Model prices alone do not supply recorded costs.</p>}{(!top.length || rows.some((row) => row.cost === undefined)) && <nav aria-label="Merge request cost next steps" className="mt-3 flex flex-wrap gap-3 text-sm"><a className="underline" href="/settings/advanced#model-prices">Set model prices</a><a className="underline" href="/settings/advanced#agent-setup">Connect sessions</a></nav>}</>;
}
export function Sessions({ runs }: { runs: AgentrunAgentRun[] }) {
  return <table className="w-full table-fixed text-left text-sm"><thead><tr><th className="w-1/2 pb-3">Session</th><th>Cost (USD)</th><th>Tokens</th></tr></thead><tbody>{sessionRows(runs).map((run, index) => <tr key={run.id ?? index} className="border-t"><td className="break-words py-3 pr-2" title={exactTime(run.started_at)}>{run.id ? <a className="underline" href={`/usage/sessions?${new URLSearchParams({ run: run.id, ...(run.repository_id ? { repository: run.repository_id } : {}) })}`}>{sessionName(run)}</a> : <>{sessionName(run)} · Sync run identity to open detail</>}<small className="block">{run.model || 'Model not reported'}</small></td><td className="break-words pr-2">{money(run.cost_usd)}</td><td className="break-words">{tokens(run)}</td></tr>)}</tbody></table>;
}
