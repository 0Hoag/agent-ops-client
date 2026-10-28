import { useQuery } from '@tanstack/react-query';
import type { AgentrunPriceVersion } from '../../../shared/api/generated/Api';
import { listPrices } from './client';

export const priceQueryKey = (organizationId: string) => ['prices', organizationId] as const;
export function usePrices(organizationId: string) {
  return useQuery({ queryKey: priceQueryKey(organizationId), queryFn: listPrices, enabled: !!organizationId });
}

export function formatRunCost(row: { cost_usd?: number; billed_cost_usd?: number; equivalent_cost_usd?: number }, currency: 'USD' | 'VND') {
  const billed = row.billed_cost_usd;
  const cost = row.cost_usd;
  const amount = currency === 'USD' ? (billed ?? cost) : row.equivalent_cost_usd;
  if (amount === undefined) return 'Unknown';
  return currency === 'USD' ? `$${amount.toFixed(4)}` : `VND ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
}

export function validPrice(price: AgentrunPriceVersion) {
  return !!price.model?.trim() && !!price.effective_date && ['input_per_million', 'cached_input_per_million', 'cache_write_per_million', 'output_per_million', 'reasoning_per_million'].every((key) => {
    const value = price[key as keyof AgentrunPriceVersion];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  });
}
