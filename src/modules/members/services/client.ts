import { api } from '../../../shared/api/client';
import type { OrganizationAcceptInvitationRequest, OrganizationCreateInvitationRequest, OrganizationUpdateRoleRequest } from '../../../shared/api/generated/Api';

export interface Membership { id: string; organization_id: string; account_id: string; role: string; }
export interface InvitationResult { token: string; link: string; }

/** Lists memberships for a single organization. */
export async function listMembers(organizationId: string): Promise<Membership[]> {
  const response = await api.api.v1OrganizationsMembersList(organizationId);
  return (response.data.data ?? []) as Membership[];
}

/** Creates a one-time invitation link using the generated request contract. */
export async function createInvitation(organizationId: string, request: OrganizationCreateInvitationRequest): Promise<InvitationResult> {
  const response = await api.api.v1OrganizationsInvitationsCreate(organizationId, request);
  return response.data.data as InvitationResult;
}

/** Accepts an invitation for the signed-in account. */
export async function acceptInvitation(request: OrganizationAcceptInvitationRequest) {
  return api.api.v1OrganizationInvitationsAcceptCreate(request);
}

/** Changes a member role with the generated API request shape. */
export async function updateMemberRole(organizationId: string, accountId: string, request: OrganizationUpdateRoleRequest) {
  return api.api.v1OrganizationsMembersPartialUpdate(organizationId, accountId, request);
}

/** Removes an organization member. */
export async function removeMember(organizationId: string, accountId: string) {
  return api.api.v1OrganizationsMembersDelete(organizationId, accountId);
}
