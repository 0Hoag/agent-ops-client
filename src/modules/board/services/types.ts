export type IssueStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
export type PageMeta = import('../../../shared/api/generated/Api').BoardListMeta & Required<Pick<import('../../../shared/api/generated/Api').BoardListMeta, 'page' | 'per_page' | 'total'>>;
export interface Page<T> { data: T[]; meta: PageMeta }
export interface Repository { id: string; provider: string; full_name: string }
export interface PipelineRun { external_id: string; status: string; conclusion: string; sha: string }
export interface PullRequest { number: number; title: string; state: string; head_sha: string; branch: string; pipeline_runs: PipelineRun[] }
export interface BoardIssue { id: string; repository_id: string; number: number; title: string; state: string; status: IssueStatus; labels: string[]; assignee: string; pull_requests: PullRequest[] }
