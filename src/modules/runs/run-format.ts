import type { AgentrunAggregate } from '../../shared/api/generated/Api';
import { cacheHitPercent } from './services/runs';
import { money } from '../../shared/format';

export const formatCost = money;
export function formatRunCost(row: AgentrunAggregate, currency: 'USD' | 'VND'): string {
  if (currency === 'VND') return row.cost_vnd === undefined ? 'VND cost unavailable — check currency pricing in Settings' : `VND ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(row.cost_vnd)}`;
  const amount = row.billed_cost_usd ?? row.cost_usd;
  if (amount === undefined) return money(undefined);
  const billed = formatCost(amount);
  return row.equivalent_cost_usd === undefined ? billed : `${billed} (equivalent API USD ${money(row.equivalent_cost_usd)})`;
}
export function formatCacheHit(row: AgentrunAggregate): string {
  const percentage = cacheHitPercent(row);
  return percentage === null ? 'No input usage — sync token usage' : `${percentage.toFixed(1)}%`;
}
