import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
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
export async function getRepositories(): Promise<Repository[]> {
  const response = await api.api.v1RepositoriesList();
  return (response.data.data ?? []).filter((repository): repository is Repository => Boolean(repository.id));
}
/** Fetches one repository board page. */
export async function getBoard(repositoryId: string, page: number): Promise<Page<BoardIssue>> {
  const response = await api.api.v1BoardList({ repository_id: repositoryId, page, per_page: 100 });
  return { ...response.data, data: response.data.data ?? [], meta: response.data.meta! as Page<BoardIssue>['meta'] };
}
/** Queries the repository list. */
export function useRepositories() { return useQuery({ queryKey: ['board', 'repositories'], queryFn: getRepositories }); }
/** Queries a repository board page. */
export function useBoard(repositoryId: string, page: number) {
  return useQuery({ queryKey: ['board', repositoryId, page], queryFn: () => getBoard(repositoryId, page), enabled: Boolean(repositoryId) });
}
