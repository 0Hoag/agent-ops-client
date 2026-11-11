import { describe, expect, it } from 'vitest';
import swagger from '../../shared/api/swagger.json';
import type { OrganizationMember } from '../../shared/api/generated/Api';

describe('published organization member contract', () => {
  it('exposes email alongside unchanged membership fields in the list response', () => {
    const member: Required<OrganizationMember> = {
      id: 'membership', organization_id: 'organization', account_id: 'account',
      role: 'member', email: 'person@example.test', created_at: '', updated_at: '',
    };
    expect(Object.keys(swagger.definitions['organization.Member'].properties).sort()).toEqual(Object.keys(member).sort());
    expect(swagger.definitions['organization.Member'].properties.email).toEqual({ type: 'string' });
    expect(swagger.paths['/api/v1/organizations/{organization_id}/members'].get.responses['200'].schema.allOf[1])
      .toEqual({ type: 'object', properties: { data: { type: 'array', items: { $ref: '#/definitions/organization.Member' } } } });
  });
});
