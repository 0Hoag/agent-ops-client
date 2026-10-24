export interface Run {
  id: string;
  repository_id: string;
  wave: string;
  worker: string;
  model: string;
  issue_numbers: number[];
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost_usd?: number;
  started_at: string;
  ended_at: string;
}

export interface RunAggregate {
  wave: string;
  worker: string;
  issue_number?: number;
  runs: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost_usd?: number;
}

export interface ApiEnvelope<T> { status: number; data: T }
