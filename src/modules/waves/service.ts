import { api } from '../../shared/api/client';
import type { WaveRequest, WaveWave, WorkerRequest } from '../../shared/api/generated/Api';

export type WorkerJob = { ID: string; State: string; Request?: WorkerRequest };
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
