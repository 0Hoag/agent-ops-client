import { api } from '../../../shared/api/client';
import type { RepositorysettingsCreateRequest, RepositorysettingsTestRequest, RepositorysettingsUpdateRequest, RepositorysettingsView } from '../../../shared/api/generated/Api';

export interface RepositoryMember { account_id: string; role: string; }

/** Resolves repository-management permission for the active organization. */
export async function getRepositoryRole(organizationId: string, accountId: string): Promise<string | undefined> {
  const response = await api.api.v1OrganizationsMembersList(organizationId);
  const members = (response.data.data ?? []) as RepositoryMember[];
  return members.find((member) => member.account_id === accountId)?.role;
}

export async function listRepositories(): Promise<RepositorysettingsView[]> {
  return (await api.api.v1RepositoriesList()).data.data ?? [];
}
export async function createRepository(input: RepositorysettingsCreateRequest) {
  return (await api.api.v1RepositoriesCreate(input)).data.data;
}
export async function updateRepository(id: string, input: RepositorysettingsUpdateRequest) {
  return (await api.api.v1RepositoriesPartialUpdate(id, input)).data.data;
}
export async function deleteRepository(id: string) {
  await api.api.v1RepositoriesDelete(id);
}

/** Checks candidate provider access through the registered HTTP endpoint. */
export async function testRepository(input: RepositorysettingsTestRequest) {
  return (await api.api.v1RepositoriesTestCreate(input)).data.data;
}

/** Requests immediate provider backfill for a persisted repository. */
export async function syncRepository(id: string) {
  // This generated operation omits the response format; parse its existing JSON envelope explicitly.
  return (await api.api.v1RepositoriesSyncCreate(id, { format: 'json' })).data.data;
}
