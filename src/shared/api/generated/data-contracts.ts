/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface AgentrunAgentRun {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  created_at?: string;
  ended_at?: string;
  id?: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model?: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  repository_id?: string;
  started_at?: string;
  updated_at?: string;
  wave?: string;
  worker?: string;
}

export interface AgentrunAggregate {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  input_tokens?: number;
  issue_number?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  runs?: number;
  wave?: string;
  worker?: string;
}

export interface AgentrunAggregateResponse {
  data?: AgentrunAggregate[];
  status?: number;
}

export interface AgentrunCreateInput {
  cache_write_tokens?: number;
  cached_input_tokens?: number;
  ended_at: string;
  input_tokens?: number;
  issue_numbers?: number[];
  model: string;
  output_tokens?: number;
  pr_number?: number;
  reasoning_tokens?: number;
  repository_id: string;
  started_at: string;
  wave: string;
  worker: string;
}

export interface AgentrunCreatedResponse {
  data?: AgentrunAgentRun;
  status?: number;
}

export interface AgentrunListResponse {
  data?: AgentrunAgentRun[];
  status?: number;
}

export interface BoardListMeta {
  page?: number;
  per_page?: number;
  total?: number;
}

export interface BoardListResponse {
  data?: any;
  meta?: BoardListMeta;
}

export interface InsightCycleMetric {
  completed?: number;
  evidence?: InsightEvidence[];
  median_seconds?: number;
}

export interface InsightEnvelope {
  data?: InsightResponse;
}

export interface InsightEvidence {
  delivery_id?: string;
  event_type?: string;
  issue_number?: number;
  pr_number?: number;
  received_at?: string;
  source_at?: string;
}

export interface InsightFirstCIMetric {
  eligible?: number;
  evidence?: InsightEvidence[];
  rate?: number;
  successful?: number;
}

export interface InsightHistory {
  complete?: boolean;
  reason?: string;
}

export interface InsightResponse {
  cycle_time?: InsightCycleMetric;
  first_ci_success?: InsightFirstCIMetric;
  history?: InsightHistory;
  repository_id?: string;
  send_back?: InsightSendBackMetric;
  suggestions?: InsightSuggestion[];
}

export interface InsightSendBackMetric {
  count?: number;
  denominator?: number;
  evidence?: InsightEvidence[];
  numerator?: number;
  rate?: number;
}

export interface InsightSuggestion {
  evidence?: InsightEvidence[];
  key?: string;
  message?: string;
  occurrences?: number;
}

export interface ResponseErrorResponse {
  message?: string;
  status?: number;
}

export interface ResponseSuccessResponse {
  data?: any;
  status?: number;
}
