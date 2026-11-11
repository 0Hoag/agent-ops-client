import { Card } from '../../shared/ui';
import { compact, money, pricedSteps, readable, relative } from './format';
import { useTimeline } from './services';

export function Timeline({ organizationId, runId }: { organizationId: string; runId?: string }) {
  const query = useTimeline(organizationId, runId);
  if (!runId) return <p>Sync the session run identity to load its timeline.</p>;
  if (query.isError) return <p role="alert">Unable to load timeline. Check your connection. <button onClick={() => void query.refetch()}>Retry</button></p>;
  if (query.isPending) return <p role="status">Loading timeline…</p>;
  if (!query.data.length) return <p>No steps recorded. Sync tool telemetry, then <button onClick={() => void query.refetch()}>Retry</button>.</p>;
  const steps = pricedSteps(query.data);
  const maximum = Math.max(0, ...steps.map((step) => step.cost ?? 0));
  let hits = 0;
  let observations = 0;
  return <><p className="mb-3">Step cost is the change in recorded cumulative USD cost. Highest-cost steps are highlighted within each run.</p><ol className="grid gap-3">{steps.map((step, index) => {
    if (step.cache_hit !== undefined) { observations += 1; if (step.cache_hit) hits += 1; }
    const trend = observations ? hits / observations * 100 : undefined;
    return <li key={step.id ?? index}><Card>
      <div className="flex flex-wrap justify-between gap-2"><strong>Step {step.sequence ?? index + 1} · {readable(step.tool_name, 'Sync tool name')}</strong><span>{money(step.cost)} {maximum > 0 && step.cost === maximum && <mark style={{ background: 'var(--surface)', color: 'var(--warn)' }}>Highest cost</mark>}</span></div>
      <p><time title={step.started_at && Number.isFinite(Date.parse(step.started_at)) ? new Date(step.started_at).toLocaleString() : undefined}>{relative(step.started_at)}</time></p>
      <p>Input {compact(step.input_tokens)} · Cached {compact(step.cached_input_tokens)} · Cache write {compact(step.cache_write_tokens)} · Output {compact(step.output_tokens)} · Reasoning {compact(step.reasoning_tokens)}</p>
      <p>Cache {step.cache_hit === undefined ? 'not reported — sync cache telemetry' : step.cache_hit ? 'hit' : 'miss'} · Cumulative hit rate {trend === undefined ? 'unavailable — sync cache telemetry' : `${Math.round(trend)}% (${hits}/${observations} reported steps)`}</p>
      {trend !== undefined && <meter className="w-full" aria-label={`Cache hit trend at step ${index + 1}`} min={0} max={100} value={trend}>{Math.round(trend)}%</meter>}
    </Card></li>;
  })}</ol><p className="mt-3 text-sm">Cache trend counts reported hits among steps with cache telemetry, not a token-weighted rate.</p></>;
}
