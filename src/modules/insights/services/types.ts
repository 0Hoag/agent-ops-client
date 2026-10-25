export interface Evidence {
  delivery_id: string;
  event_type: string;
  received_at: string;
  source_at?: string;
  pr_number?: number;
  issue_number?: number;
}

export interface InsightsResponse {
  repository_id: string;
  history: { complete: boolean; reason?: string };
  send_back: { count: number; rate: number; numerator: number; denominator: number; evidence: Evidence[] };
  first_ci_success: { successful: number; eligible: number; rate: number; evidence: Evidence[] };
  cycle_time: { completed: number; median_seconds: number; evidence: Evidence[] };
  suggestions: { key: string; message: string; occurrences: number; evidence: Evidence[] }[];
}

export interface Repository { id: string; provider: string; full_name: string }
export interface RepositoryPage { data: Repository[]; meta: { page: number; per_page: number; total: number } }
