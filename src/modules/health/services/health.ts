import { useQuery } from '@tanstack/react-query';
import { healthApi } from './client';
import type { HealthEnvelope, HealthResponse } from './types';

/** Fetches the API health status. */
export async function getHealth(): Promise<HealthResponse> {
  const response = await healthApi.get<HealthEnvelope>('/healthz');
  return response.data.data;
}
/** Queries the API health status. */
export function useHealth() { return useQuery({ queryKey: ['health'], queryFn: getHealth }); }
