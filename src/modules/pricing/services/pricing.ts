import { useQuery } from '@tanstack/react-query';
import type { AgentrunPriceVersion } from '../../../shared/api/generated/Api';
import { listPrices } from './client';

export const priceQueryKey = (organizationId: string) => ['prices', organizationId] as const;
export function usePrices(organizationId: string) {
  return useQuery({ queryKey: priceQueryKey(organizationId), queryFn: listPrices, enabled: !!organizationId });
}

export function validPrice(price: AgentrunPriceVersion) {
  return !!price.model?.trim() && !!price.effective_date && ['input_per_million', 'cached_input_per_million', 'cache_write_per_million', 'output_per_million', 'reasoning_per_million'].every((key) => {
    const value = price[key as keyof AgentrunPriceVersion];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  });
}
