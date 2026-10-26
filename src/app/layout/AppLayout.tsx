import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { paths } from '../paths';
import { hasToken, listOrganizations, logout, selectOrganization, type Organization } from '../../modules/auth/services/auth';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; const load = () => { if (!hasToken()) return; const token = sessionStorage.getItem('agent-ops-token'); void listOrganizations().then((items) => { if (active && sessionStorage.getItem('agent-ops-token') === token) { setOrganizations(items); setOrganizationId(''); } }).catch(() => { if (active && sessionStorage.getItem('agent-ops-token') === token) setError('Unable to load organizations.'); }); }; const changed = () => { setOrganizationId(''); }; const logoutChanged = () => { setOrganizations([]); setOrganizationId(''); }; const clearTenantData = () => { void queryClient.cancelQueries(); queryClient.clear(); }; window.addEventListener('auth:session-restored', load); window.addEventListener('auth:unauthorized', logoutChanged); window.addEventListener('organization:changed', changed); window.addEventListener('organization:will-change', clearTenantData); return () => { active = false; window.removeEventListener('auth:session-restored', load); window.removeEventListener('auth:unauthorized', logoutChanged); window.removeEventListener('organization:changed', changed); window.removeEventListener('organization:will-change', clearTenantData); }; }, [queryClient]);
  async function switchOrganization(id: string) {
    if (!id || id === organizationId) return;
    setError('');
    try {
      await selectOrganization(id);
      setOrganizationId(id);
      window.dispatchEvent(new Event('organization:changed'));
    } catch { setError('Unable to switch organizations. Your current session was retained.'); }
  }
  return <div className="flex min-h-screen">{hasToken() && <aside className="w-56 bg-slate-900 p-6 text-white"><h1 className="mb-8 text-xl font-bold">Agent Ops</h1><nav className="grid gap-3"><NavLink to={paths.board} className="rounded px-3 py-2 hover:bg-slate-700">Board</NavLink><NavLink to={paths.runs} className="rounded px-3 py-2 hover:bg-slate-700">Runs</NavLink><NavLink to={paths.insights} className="rounded px-3 py-2 hover:bg-slate-700">Insights</NavLink><NavLink to={paths.health} className="rounded px-3 py-2 hover:bg-slate-700">Health</NavLink>{organizations.length > 0 && <label className="grid gap-1 text-sm">Organization<select aria-label="Organization" className="rounded border bg-slate-800 p-2" value={organizationId} onChange={(event) => void switchOrganization(event.target.value)}><option value="">Select organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}{error && <p role="alert">{error}</p>}<button className="rounded px-3 py-2 text-left hover:bg-slate-700" onClick={() => { logout(); void queryClient.clear(); navigate(paths.login); }}>Sign out</button></nav></aside>}<main className="min-w-0 flex-1 p-6">{children}</main></div>;
}
