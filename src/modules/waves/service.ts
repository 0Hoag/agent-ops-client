import { api } from '../../shared/api/client';
import type { WaveRequest, WaveWave } from '../../shared/api/generated/Api';

export async function listWaves(): Promise<WaveWave[]> {
  return (await api.api.v1WavesList()).data.data ?? [];
}

export async function createWave(input: WaveRequest): Promise<void> {
  await api.api.v1WavesCreate(input);
}

export async function updateWaveState(id: string, state: string): Promise<void> {
  await api.api.v1WavesPartialUpdate(id, { state });
}
