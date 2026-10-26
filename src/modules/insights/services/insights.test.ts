import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { getRepositories } from './insights';

vi.mock('../../../shared/api/client', () => ({ api: { api: { v1RepositoriesList: vi.fn() } } }));

describe('insights repository selection', () => {
  beforeEach(() => vi.clearAllMocks());
  it('consumes the unpaginated generated list and keeps valid IDs', async () => {
    vi.mocked(api.api.v1RepositoriesList).mockResolvedValue({ data: { data: [{ id: 'repo-1', name: 'one', organization: 'org' }, { name: 'invalid' }] } } as never);
    await expect(getRepositories()).resolves.toEqual([{ id: 'repo-1', name: 'one', organization: 'org' }]);
    expect(api.api.v1RepositoriesList).toHaveBeenCalledWith();
  });
});
