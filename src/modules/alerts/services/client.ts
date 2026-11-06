import { api } from '../../../shared/api/client';
import type { AlertOccurrence } from '../../../shared/api/generated/Api';
export async function alertOrganization(): Promise<string> {
  return (await api.api.v1AuthSessionList()).data.organization_id ?? '';
}
export async function listAlertHistory(page: number, perPage: number): Promise<{ data: AlertOccurrence[]; total: number }> {
  const response = await api.api.v1AlertsHistoryList({ page, per_page: perPage });
  return { data: response.data.data ?? [], total: response.data.meta?.total ?? 0 };
}
