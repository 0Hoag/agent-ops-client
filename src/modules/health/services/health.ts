import { useQuery } from '@tanstack/react-query';
import { healthApi } from './client';
import type { HealthResponse } from './types';

/** Fetches the API health status. */
export async function getHealth(): Promise<HealthResponse> {
  const response = await healthApi.get<HealthResponse>('/healthz');
  return response.data;
}
/** Queries the API health status. */
export function useHealth() { return useQuery({ queryKey: ['health'], queryFn: getHealth }); }
