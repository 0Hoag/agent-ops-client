// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { MembersPage } from './MembersPage';

const owner = '11111111-1111-4111-8111-111111111111';
const alice = '22222222-2222-4222-8222-222222222222';
const bob = '33333333-3333-4333-8333-333333333333';
const people = [
  { account_id: owner, email: 'owner@example.test', role: 'owner' },
  { account_id: alice, email: 'alice@example.test', role: 'member' },
  { account_id: bob, email: 'bob@example.test', role: 'viewer' },
];

function setup(members: { account_id: string; email?: string; role: string }[] = people) {
  const request = vi.spyOn(http, 'request').mockImplementation(async (config) => ({
    status: 200, data: config.url?.endsWith('/auth/session')
      ? { organization_id: 'org-a', account_id: owner }
      : { data: members },
  }));
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MembersPage /></QueryClientProvider></MemoryRouter>);
  return request;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('member identities', () => {
  it('associates distinct real emails and role/remove actions with the correct account IDs', async () => {
    const request = setup();
    for (const [email, id, role] of [['alice@example.test', alice, 'admin'], ['bob@example.test', bob, 'member']]) {
      const row = (await screen.findByText(email)).closest('tr')!;
      fireEvent.change(within(row).getByRole('combobox', { name: `Role for ${email}` }), { target: { value: role } });
      await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'PATCH', url: `/api/v1/organizations/org-a/members/${id}`, data: JSON.stringify({ role }),
      })));
      fireEvent.click(within(row).getByRole('button', { name: `Remove ${email}` }));
      await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'DELETE', url: `/api/v1/organizations/org-a/members/${id}`,
      })));
    }
    for (const id of [owner, alice, bob]) expect(document.body.textContent).not.toContain(id);
  });

  it.each([undefined, '', '   '])('offers actionable fallback without unsafe controls when email is %s', async (email) => {
    const request = setup([people[0], { ...people[1], email }]);
    const row = (await screen.findByText('Identity unavailable')).closest('tr')!;
    expect(within(row).getByText(/Reload members.*contact your organization administrator/)).toBeTruthy();
    expect(within(row).queryByRole('combobox')).toBeNull();
    expect(within(row).queryByRole('button', { name: /Remove/ })).toBeNull();
    const before = request.mock.calls.length;
    fireEvent.click(within(row).getByRole('button', { name: 'Reload members' }));
    await waitFor(() => expect(request.mock.calls.length).toBeGreaterThan(before));
    expect(document.body.textContent).not.toContain(alice);
    expect(document.body.innerHTML).not.toContain(alice);
  });
});
