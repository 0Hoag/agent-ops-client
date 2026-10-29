import type { AgentrunAggregate } from '../../shared/api/generated/Api';
import { cacheHitPercent } from './services/runs';

export function formatCost(value: number | undefined): string { return value === undefined ? 'Unknown' : `$${value.toFixed(4)}`; }
export function formatRunCost(row: AgentrunAggregate, currency: 'USD' | 'VND'): string {
  if (currency === 'VND') return row.cost_vnd === undefined ? 'Unknown' : `VND ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(row.cost_vnd)}`;
  const amount = row.billed_cost_usd ?? row.cost_usd;
  if (amount === undefined) return 'Unknown';
  const billed = formatCost(amount);
  return row.equivalent_cost_usd === undefined ? billed : `${billed} (equivalent API USD $${row.equivalent_cost_usd.toFixed(4)})`;
}
export function formatCacheHit(row: AgentrunAggregate): string {
  const percentage = cacheHitPercent(row);
  return percentage === null ? 'N/A' : `${percentage.toFixed(1)}%`;
}
