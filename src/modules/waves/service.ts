import { api } from '../../shared/api/client';
import type { WaveRequest, WaveWave, WorkerActionAudit, WorkerAuditHistoryResponse, WorkerRequest } from '../../shared/api/generated/Api';

// The controller serializes Go ActionAudit fields without JSON tags. Keep the
// generated lower-camel contract compatible, but normalize the actual wire shape.
type WireAudit = WorkerActionAudit & Partial<Record<'ID' | 'OrganizationID' | 'ActorID' | 'OccurredAt' | 'CreatedAt' | 'Action' | 'Wave' | 'JobID' | 'Outcome', string | null>>;
function normalizeWorkerAudit(entry: WireAudit): WorkerActionAudit {
  return {
    id: entry.ID ?? entry.id ?? undefined,
    organizationID: entry.OrganizationID ?? entry.organizationID ?? undefined,
    actorID: entry.ActorID ?? entry.actorID ?? undefined,
    occurredAt: entry.OccurredAt ?? entry.occurredAt ?? undefined,
    createdAt: entry.CreatedAt ?? entry.createdAt ?? undefined,
    action: entry.Action ?? entry.action ?? undefined,
    wave: entry.Wave ?? entry.wave ?? undefined,
    jobID: entry.JobID ?? entry.jobID ?? undefined,
    outcome: entry.Outcome ?? entry.outcome ?? undefined,
  };
}

export type WorkerJob = { ID: string; State: string; Request?: WorkerRequest };
export async function listWorkerAuditHistory(page: number, perPage: number): Promise<WorkerAuditHistoryResponse> {
  const response = (await api.api.v1WorkersAuditHistoryList({ page, per_page: perPage })).data;
  return { ...response, data: response.data?.map(normalizeWorkerAudit) };
}
export async function startWorker(input: WorkerRequest): Promise<WorkerJob> {
  return (await api.api.v1WorkersStartCreate(input)).data.data as WorkerJob;
}
export async function getWorker(id: string): Promise<WorkerJob> {
  return (await api.api.v1WorkersDetail(id)).data.data as WorkerJob;
}
export async function stopWorker(id: string): Promise<void> {
  await api.api.v1WorkersStopCreate(id);
}
export async function restartWorker(input: WorkerRequest): Promise<WorkerJob> {
  return (await api.api.v1WorkersRestartCreate(input)).data.data as WorkerJob;
}

export async function listWaves(): Promise<WaveWave[]> {
  return (await api.api.v1WavesList()).data.data ?? [];
}

export async function createWave(input: WaveRequest): Promise<void> {
  await api.api.v1WavesCreate(input);
}

export async function updateWaveState(id: string, state: string): Promise<void> {
  await api.api.v1WavesPartialUpdate(id, { state });
}

export async function updateWaveBrief(id: string, brief: string): Promise<void> {
  await api.api.v1WavesPartialUpdate(id, { brief });
}
