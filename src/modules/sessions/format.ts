import type { AgentrunRunStep, RepositorysettingsView } from '../../shared/api/generated/Api';

export const readable = (value: string | undefined, fallback: string) => value?.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'identifier omitted') || fallback;
export const money = (value?: number) => value === undefined ? 'Cost unavailable — configure model pricing in Settings' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
export const compact = (value?: number) => value === undefined ? 'Not reported — sync token usage' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export function total(values: (number | undefined)[]) { return values.length && values.every((value) => value !== undefined) ? values.reduce<number>((sum, value) => sum + value!, 0) : undefined; }
export function relative(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sync timestamps';
  const seconds = (Date.parse(value) - Date.now()) / 1000;
  const unit = Math.abs(seconds) >= 86400 ? 'day' : Math.abs(seconds) >= 3600 ? 'hour' : 'minute';
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / (unit === 'day' ? 86400 : unit === 'hour' ? 3600 : 60)), unit);
}
export function pricedSteps(steps: AgentrunRunStep[]) {
  return [...steps].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).map((step, index, sorted) => {
    const previous = index === 0 ? 0 : sorted[index - 1].cumulative_cost_usd;
    const cost = step.cumulative_cost_usd !== undefined && previous !== undefined && step.cumulative_cost_usd >= previous ? step.cumulative_cost_usd - previous : undefined;
    return { ...step, cost };
  });
}
export function mergeRequestUrl(repo: RepositorysettingsView | undefined, number: number) {
  if (!repo?.full_name || !Number.isInteger(number) || number <= 0) return undefined;
  const path = repo.full_name.split('/').map(encodeURIComponent).join('/');
  if (repo.provider === 'github') return `https://github.com/${path}/pull/${number}`;
  if (repo.provider !== 'gitlab' || !repo.gitlab_base_url) return undefined;
  try {
    const base = new URL(repo.gitlab_base_url);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) return undefined;
    return `${base.href.replace(/\/$/, '')}/${path}/-/merge_requests/${number}`;
  } catch { return undefined; }
}
