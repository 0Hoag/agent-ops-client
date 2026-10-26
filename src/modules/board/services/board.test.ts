import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { getRepositories, ciLabel, groupIssues } from './board';
import type { BoardIssue } from './types';

const issue = (status: BoardIssue['status'], number: number): BoardIssue => ({ id: String(number), repository_id: 'r', number, title: `Issue ${number}`, state: 'open', status, labels: [], assignee: '', pull_requests: [] });
vi.mock('../../../shared/api/client', () => ({ api: { api: { v1RepositoriesList: vi.fn() } } }));

describe('repository selection', () => {
  beforeEach(() => vi.clearAllMocks());
  it('consumes the unpaginated generated list and keeps valid IDs', async () => {
    vi.mocked(api.api.v1RepositoriesList).mockResolvedValue({ data: { data: [{ id: 'repo-1', name: 'one', organization: 'org' }, { name: 'invalid' }] } } as never);
    await expect(getRepositories()).resolves.toEqual([{ id: 'repo-1', name: 'one', organization: 'org' }]);
    expect(api.api.v1RepositoriesList).toHaveBeenCalledWith();
  });
});

describe('board mappings', () => {
  it('groups every status without moving records', () => {
    const grouped = groupIssues(['todo', 'in_progress', 'review', 'blocked', 'done'].map((status, index) => issue(status as BoardIssue['status'], index)));
    expect(Object.values(grouped).map((items) => items[0].status)).toEqual(['todo', 'in_progress', 'review', 'blocked', 'done']);
    expect(Object.values(grouped).flat().map((item) => item.number)).toEqual([0, 1, 2, 3, 4]);
  });
  it('maps CI success, failure and running states', () => {
    expect(ciLabel({ status: 'completed', conclusion: 'success' })).toBe('Passed');
    expect(ciLabel({ status: 'completed', conclusion: 'failure' })).toBe('Failed');
    expect(ciLabel({ status: 'in_progress', conclusion: '' })).toBe('Running');
  });
});
