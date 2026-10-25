import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { paths } from '../paths';
import { hasToken, logout } from '../../modules/auth/services/auth';
import { useQueryClient } from '@tanstack/react-query';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return <div className="flex min-h-screen">{hasToken() && <aside className="w-56 bg-slate-900 p-6 text-white"><h1 className="mb-8 text-xl font-bold">Agent Ops</h1><nav className="grid gap-3"><NavLink to={paths.board} className="rounded px-3 py-2 hover:bg-slate-700">Board</NavLink><NavLink to={paths.runs} className="rounded px-3 py-2 hover:bg-slate-700">Runs</NavLink><NavLink to={paths.insights} className="rounded px-3 py-2 hover:bg-slate-700">Insights</NavLink><NavLink to={paths.health} className="rounded px-3 py-2 hover:bg-slate-700">Health</NavLink><button className="rounded px-3 py-2 text-left hover:bg-slate-700" onClick={() => { logout(); void queryClient.clear(); navigate(paths.login); }}>Sign out</button></nav></aside>}<main className="min-w-0 flex-1 p-6">{children}</main></div>;
}
