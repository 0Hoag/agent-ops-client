import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { paths } from '../paths';
import { hasToken, listOrganizations, logout, selectOrganization, validateSession, type Organization } from '../../modules/auth/services/auth';
import { api } from '../../shared/api/client';

type Repository = { id: string; full_name: string };
const nav = [{ label: 'Overview', to: paths.board }, { label: 'Work', to: paths.work }, { label: 'Usage', to: paths.insights }, { label: 'Settings', to: paths.advanced }];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repository, setRepository] = useState(localStorage.getItem('agent-ops-repository') ?? '');
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = (event: Event) => {
      if (!hasToken()) return;
      const token = sessionStorage.getItem('agent-ops-token');
      const current = () => active && sessionStorage.getItem('agent-ops-token') === token;
      const loadOrganization = async (id = '') => {
        if (!current()) return;
        setOrganizationId(id);
        if (!id) return;
        const orgs = await listOrganizations();
        if (!current()) return;
        setOrganizations(orgs);
        setOrganizationName(orgs.find((item) => item.id === id)?.name ?? '');
        const response = await api.api.v1RepositoriesList();
        if (current()) setRepositories((response.data.data ?? []) as Repository[]);
      };
      const fail = () => { if (current()) setError('Unable to load organization.'); };
      if (event.type === 'auth:session-restored') {
        const { organizationId: id } = (event as CustomEvent<{ organizationId?: string }>).detail;
        void loadOrganization(id).catch(fail);
      } else {
        void validateSession((id) => { void loadOrganization(id).catch(fail); }).catch(fail);
      }
    };
    const reset = () => { setOrganizationId(''); setOrganizationName(''); setRepositories([]); };
    const clear = () => { void queryClient.cancelQueries(); queryClient.clear(); };
    const signout = () => { setOrganizations([]); reset(); };
    window.addEventListener('auth:session-restored', load); window.addEventListener('auth:unauthorized', signout); window.addEventListener('organization:changed', load); window.addEventListener('organization:will-change', clear);
    return () => { active = false; window.removeEventListener('auth:session-restored', load); window.removeEventListener('auth:unauthorized', signout); window.removeEventListener('organization:changed', load); window.removeEventListener('organization:will-change', clear); };
  }, [queryClient]);
  async function switchOrganization(id: string) { if (!id || id === organizationId) return; try { await selectOrganization(id); setOrganizationId(id); window.dispatchEvent(new Event('organization:changed')); } catch { setError('Unable to switch organizations. Your current session was retained.'); } }
  const authenticated = hasToken();
  return <div className="min-h-screen md:flex">{authenticated && <><button className="m-3 rounded border p-2 md:hidden" aria-label="Open navigation" onClick={() => setDrawer(!drawer)}>☰</button><aside className={`${drawer ? 'block' : 'hidden'} fixed inset-0 z-20 w-72 bg-slate-900 p-6 text-white md:static md:block md:w-56 md:shrink-0`}><div className="mb-8 flex justify-between"><h1 className="text-xl font-bold">Agent Ops</h1><button aria-label="Close navigation" className="md:hidden" onClick={() => setDrawer(false)}>×</button></div><nav className="grid gap-2">{nav.map((item) => <NavLink key={item.label} to={item.to} onClick={() => setDrawer(false)} className={({ isActive }) => `rounded px-3 py-2 ${isActive ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>{item.label}</NavLink>)}{organizations.length > 0 && <label className="mt-4 grid gap-1 text-sm">Organization<select aria-label="Organization" className="rounded border bg-slate-800 p-2" value={organizationId} onChange={(event) => void switchOrganization(event.target.value)}><option value="">Select organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}</nav></aside><header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b bg-white p-4"><strong aria-label="Current organization">{organizationName || 'Organization'}</strong><label>Repository<select aria-label="Repository" className="ml-2 max-w-48 rounded border p-2" value={repository} onChange={(event) => { setRepository(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">All repositories</option>{repositories.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label><details><summary className="cursor-pointer">User menu</summary><button className="p-2" onClick={() => { logout(); void queryClient.clear(); navigate(paths.login); }}>Sign out</button></details>{error && <p role="alert">{error}</p>}</header></> }<main className="min-w-0 flex-1 p-6">{children}</main></div>;
}
