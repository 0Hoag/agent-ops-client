import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { acceptInvitation, createInvitation, listMembers, removeMember, updateMemberRole } from './services/client';

const roles = ['admin', 'member', 'viewer'];

/** Displays tenant-scoped members and server-authorized membership actions. */
export function MembersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => { void api.api.v1AuthSessionList().then((response) => { if (active) setOrganizationId(response.data.organization_id ?? ''); }).catch(() => { if (active) setOrganizationId(''); }); };
    const changed = () => { setOrganizationId(''); void queryClient.invalidateQueries({ queryKey: ['members'] }); load(); };
    load(); window.addEventListener('organization:changed', changed);
    return () => { active = false; window.removeEventListener('organization:changed', changed); };
  }, [queryClient]);
  const session = useQuery({ queryKey: ['members', 'session', organizationId], enabled: Boolean(organizationId), queryFn: async () => (await api.api.v1AuthSessionList()).data });
  const members = useQuery({ queryKey: ['members', organizationId], enabled: Boolean(organizationId), queryFn: () => listMembers(organizationId) });
  const role = members.data?.find((member) => member.account_id === session.data?.account_id)?.role;
  const canManage = role === 'owner' || role === 'admin';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members', organizationId] });
  const invite = useMutation({ mutationFn: () => createInvitation(organizationId, { role: inviteRole }), onSuccess: (result) => { setInviteLink(new URL(result.link, window.location.origin).toString()); setError(''); } });
  const update = useMutation({ mutationFn: ({ id, value }: { id: string; value: string }) => updateMemberRole(organizationId, id, { role: value }), onSuccess: () => void invalidate() });
  const remove = useMutation({ mutationFn: (id: string) => removeMember(organizationId, id), onSuccess: () => void invalidate() });
  const accept = useMutation({ mutationFn: (token: string) => acceptInvitation({ token }), onSuccess: () => navigate('/members') });
  if (!organizationId) return <section><h1 className="text-2xl font-semibold">Members</h1><p role="status">Select an organization to view members.</p></section>;
  return <section><h1 className="mb-5 text-2xl font-semibold">Members</h1>
    {members.isPending && <p role="status">Loading members…</p>}{members.isError && <p role="alert">Unable to load members: {members.error.message}</p>}
    {members.data?.length === 0 && <p>No members found.</p>}
    {members.data && <div className="overflow-x-auto"><table className="w-full bg-white text-left text-sm"><thead><tr><th className="p-3">Account</th><th className="p-3">Role</th><th /></tr></thead><tbody>{members.data.map((member) => <tr className="border-t" key={member.account_id}><td className="p-3">{member.account_id}</td><td className="p-3">{member.role}</td><td className="p-3">{canManage && member.account_id !== session.data?.account_id && <><select aria-label={`Role for ${member.account_id}`} value={member.role} onChange={(event) => update.mutate({ id: member.account_id, value: event.target.value })}>{roles.map((item) => <option key={item}>{item}</option>)}</select><button className="ml-3" onClick={() => remove.mutate(member.account_id)}>Remove</button></>}</td></tr>)}</tbody></table></div>}
    {canManage && <form className="mt-6 flex gap-3" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}><label>Invite role<select className="ml-2" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={invite.isPending}>Create invitation link</button></form>}
    {invite.isError && <p role="alert">Unable to create invitation.</p>}{inviteLink && <p>Invitation link: <a href={inviteLink}>{inviteLink}</a></p>}{error && <p role="alert">{error}</p>}{(update.isError || remove.isError) && <p role="alert">Unable to update membership.</p>}{accept.isError && <p role="alert">Unable to accept invitation.</p>}
  </section>;
}
