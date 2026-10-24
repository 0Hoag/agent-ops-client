import { useQuery } from '@tanstack/react-query';
import { boardApi } from './client';
import type { BoardIssue, IssueStatus, Page, Repository } from './types';

export const statuses: IssueStatus[] = ['todo', 'in_progress', 'review', 'blocked', 'done'];
/** Groups issues by their workflow status. */
export function groupIssues(issues: BoardIssue[]): Record<IssueStatus, BoardIssue[]> {
  return Object.fromEntries(statuses.map((status) => [status, issues.filter((issue) => issue.status === status)])) as Record<IssueStatus, BoardIssue[]>;
}
/** Converts a CI run into its display label. */
export function ciLabel(run: { status: string; conclusion: string }): string {
  if (run.status.toLowerCase() !== 'completed') return 'Running';
  const result = run.conclusion.toLowerCase();
  return result === 'success' ? 'Passed' : result === 'failure' ? 'Failed' : result || 'Completed';
}
/** Fetches the GitHub repositories available to the current user. */
export async function getRepositories(): Promise<Page<Repository>> {
  return (await boardApi.get<Page<Repository>>('/api/v1/repositories', { params: { page: 1, per_page: 100 } })).data;
}
/** Fetches one repository board page. */
export async function getBoard(repositoryId: string, page: number): Promise<Page<BoardIssue>> {
  return (await boardApi.get<Page<BoardIssue>>('/api/v1/board', { params: { repository_id: repositoryId, page, per_page: 100 } })).data;
}
/** Queries the repository list. */
export function useRepositories() { return useQuery({ queryKey: ['board', 'repositories'], queryFn: getRepositories }); }
/** Queries a repository board page. */
export function useBoard(repositoryId: string, page: number) {
  return useQuery({ queryKey: ['board', repositoryId, page], queryFn: () => getBoard(repositoryId, page), enabled: Boolean(repositoryId) });
}
