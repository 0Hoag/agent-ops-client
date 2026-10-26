import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { createRepository, deleteRepository, getRepositoryRole, listRepositories, updateRepository } from './repositories';

describe('repository API seam', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses generated list/create/PATCH/delete operations and unwraps list data', async () => {
    vi.spyOn(api.api, 'v1RepositoriesList').mockResolvedValue({ data: { data: [{ id: 'repo' }] } } as never);
    const create = vi.spyOn(api.api, 'v1RepositoriesCreate').mockResolvedValue({ data: { data: { id: 'created' } } } as never);
    const update = vi.spyOn(api.api, 'v1RepositoriesPartialUpdate').mockResolvedValue({ data: { data: { id: 'repo' } } } as never);
    const remove = vi.spyOn(api.api, 'v1RepositoriesDelete').mockResolvedValue({} as never);
    expect(await listRepositories()).toEqual([{ id: 'repo' }]);
    await createRepository({ provider: 'github', full_name: 'acme/repo' });
    await updateRepository('repo', { status_mappings: { open: 'todo' } });
    await deleteRepository('repo');
    expect(create).toHaveBeenCalledWith({ provider: 'github', full_name: 'acme/repo' });
    expect(update).toHaveBeenCalledWith('repo', { status_mappings: { open: 'todo' } });
    expect(remove).toHaveBeenCalledWith('repo');
  });
  it('gets the active account role within its org using only local generated seam', async () => {
    vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'a', role: 'owner' }, { account_id: 'b', role: 'viewer' }] } } as never);
    expect(await getRepositoryRole('org', 'b')).toBe('viewer');
  });
});
