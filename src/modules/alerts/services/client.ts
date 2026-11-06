import { api } from '../../../shared/api/client';
import type { AlertOccurrence, AlertThresholdRequest, AlertThresholdsResponse } from '../../../shared/api/generated/Api';
export async function alertOrganization(): Promise<string> {
  return (await api.api.v1AuthSessionList()).data.organization_id ?? '';
}
export async function getAlertThresholds(): Promise<AlertThresholdsResponse> {
  return (await api.api.v1AlertsThresholdsList()).data;
}
export async function updateAlertThresholds(thresholds: AlertThresholdRequest): Promise<AlertThresholdsResponse> {
  return (await api.api.v1AlertsThresholdsUpdate(thresholds)).data;
}
export async function listAlertHistory(page: number, perPage: number): Promise<{ data: AlertOccurrence[]; total: number }> {
  const response = await api.api.v1AlertsHistoryList({ page, per_page: perPage });
  return { data: response.data.data ?? [], total: response.data.meta?.total ?? 0 };
}
