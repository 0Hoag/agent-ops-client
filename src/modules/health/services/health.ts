import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';

/** Fetches the API health status. */
export async function getHealth() {
  return (await api.healthz.healthzList()).data;
}
/** Queries the API health status. */
export function useHealth() { return useQuery({ queryKey: ['health'], queryFn: getHealth }); }
