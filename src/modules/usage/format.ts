import type { AgentrunAgentRun, InsightAnalyticsBucket } from '../../shared/api/generated/Api';

export const money = (value?: number) => value === undefined ? 'Unavailable — check model pricing in Settings' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
export const compact = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export function sum(values: (number | undefined)[]) { return values.length && values.every((value) => value !== undefined) ? values.reduce<number>((total, value) => total + value!, 0) : undefined; }
export function relativeTime(value?: string, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time unavailable';
  const hours = (Date.parse(value) - now) / 3600000;
  const unit = Math.abs(hours) >= 24 ? 'day' : Math.abs(hours) >= 1 ? 'hour' : 'minute';
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(unit === 'day' ? hours / 24 : unit === 'hour' ? hours : hours * 60), unit);
}
export function sessionName(run: AgentrunAgentRun) { return `${run.harness || 'Agent'} · ${run.branch || 'Default branch'} · ${relativeTime(run.started_at)}`; }
export function tokens(run: AgentrunAgentRun) {
  const total = sum([run.input_tokens, run.cached_input_tokens, run.cache_write_tokens, run.output_tokens]);
  return total === undefined ? 'Unavailable — sync token usage' : compact(total);
}
export function groupCosts<T>(rows: T[], key: (row: T) => string, cost: (row: T) => number | undefined) {
  const groups = new Map<string, (number | undefined)[]>();
  rows.forEach((row) => { const name = key(row); groups.set(name, [...(groups.get(name) ?? []), cost(row)]); });
  return [...groups].map(([name, values]) => ({ name, cost: sum(values) }));
}
export function dailyCosts(buckets: InsightAnalyticsBucket[]) {
  return groupCosts(buckets, (row) => row.start?.slice(0, 10) || 'Date unavailable', (row) => row.unknown_price_count ? undefined : row.actual_cost_usd).sort((a, b) => a.name.localeCompare(b.name));
}
export function sessionRows(runs: AgentrunAgentRun[]) {
  const groups = new Map<string, AgentrunAgentRun[]>();
  runs.forEach((run, index) => {
    const key = `${run.repository_id ?? ''}:${run.session_id || run.id || index}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  });
  return [...groups.values()].map((rows) => ({
    ...rows[0],
    cost_usd: sum(rows.map((row) => row.cost_usd)),
    input_tokens: sum(rows.map((row) => row.input_tokens)),
    cached_input_tokens: sum(rows.map((row) => row.cached_input_tokens)),
    cache_write_tokens: sum(rows.map((row) => row.cache_write_tokens)),
    output_tokens: sum(rows.map((row) => row.output_tokens)),
  }));
}
