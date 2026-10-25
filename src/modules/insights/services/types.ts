export type Evidence = import('../../../shared/api/generated/Api').InsightEvidence;
type Metric<T> = { [K in keyof T]-?: K extends 'evidence' ? Evidence[] : NonNullable<T[K]> };
export type InsightsResponse = Omit<import('../../../shared/api/generated/Api').InsightResponse, 'history' | 'send_back' | 'first_ci_success' | 'cycle_time' | 'suggestions'> & {
  history: { complete: boolean; reason?: string };
  send_back: Metric<NonNullable<import('../../../shared/api/generated/Api').InsightResponse['send_back']>>;
  first_ci_success: Metric<NonNullable<import('../../../shared/api/generated/Api').InsightResponse['first_ci_success']>>;
  cycle_time: Metric<NonNullable<import('../../../shared/api/generated/Api').InsightResponse['cycle_time']>>;
  suggestions: ({ [K in keyof import('../../../shared/api/generated/Api').InsightSuggestion]-?: K extends 'evidence' ? Evidence[] : NonNullable<import('../../../shared/api/generated/Api').InsightSuggestion[K]> })[];
};

export interface Repository { id: string; provider: string; full_name: string }
export interface RepositoryPage { data: Repository[]; meta: import('../../../shared/api/generated/Api').BoardListMeta & Required<Pick<import('../../../shared/api/generated/Api').BoardListMeta, 'page' | 'per_page' | 'total'>> }
