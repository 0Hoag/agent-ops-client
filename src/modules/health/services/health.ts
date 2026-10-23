import { useQuery } from '@tanstack/react-query';
import { http } from '../../../shared/http';
import type { HealthResponse } from './types';

export async function getHealth(): Promise<HealthResponse> {
  const response = await http.get<HealthResponse>('/healthz');
  return { status: response.data.status, uptime: response.data.uptime };
}
export function useHealth() { return useQuery({ queryKey: ['health'], queryFn: getHealth }); }
