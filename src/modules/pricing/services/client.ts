import { api } from '../../../shared/api/client';
import type { AgentrunPriceVersion } from '../../../shared/api/generated/Api';

export async function listPrices(): Promise<AgentrunPriceVersion[]> {
  return (await api.api.v1AgentRunPricesList()).data.data ?? [];
}

export async function createPrice(price: AgentrunPriceVersion): Promise<void> {
  await api.api.v1AgentRunPricesCreate(price);
}

export async function updatePrice(id: string, price: AgentrunPriceVersion): Promise<void> {
  await api.api.v1AgentRunPricesPartialUpdate(id, price);
}
