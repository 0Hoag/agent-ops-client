import { api } from '../../../shared/api/client';
import type { AlertOccurrence, AlertThresholdRequest, AlertThresholdsResponse, AlertChannelRequest, AlertChannelResponse } from '../../../shared/api/generated/Api';
export async function listAlertChannels(): Promise<AlertChannelResponse[]> {
  // The endpoint uses response.OK's envelope, unlike its generated array type.
  const body = (await api.api.v1AlertsChannelsList()).data as unknown as { status: number; data: AlertChannelResponse[] };
  return body.data;
}
export async function createAlertChannel(channel: AlertChannelRequest): Promise<AlertChannelResponse> { return (await api.api.v1AlertsChannelsCreate(channel)).data; }
export async function updateAlertChannel(kind: string, channel: AlertChannelRequest): Promise<AlertChannelResponse> { return (await api.api.v1AlertsChannelsUpdate(kind, channel)).data; }
export async function deleteAlertChannel(kind: string): Promise<void> { await api.api.v1AlertsChannelsDelete(kind); }
export async function alertOrganization(): Promise<string> {
  return (await api.api.v1AuthSessionList()).data.organization_id ?? '';
}
export async function getAlertThresholds(): Promise<AlertThresholdsResponse> {
  return ((await api.api.v1AlertsThresholdsList()).data as unknown as { data: AlertThresholdsResponse }).data;
}
export async function updateAlertThresholds(thresholds: AlertThresholdRequest): Promise<AlertThresholdsResponse> {
  return ((await api.api.v1AlertsThresholdsUpdate(thresholds)).data as unknown as { data: AlertThresholdsResponse }).data;
}
export async function listAlertHistory(page: number, perPage: number): Promise<{ data: AlertOccurrence[]; total: number }> {
  const response = await api.api.v1AlertsHistoryList({ page, per_page: perPage });
  return { data: response.data.data ?? [], total: response.data.meta?.total ?? 0 };
}
