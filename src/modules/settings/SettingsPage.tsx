import { useEffect, useState } from 'react';
import { RepositoriesPage } from '../repositories/page';
import { PricingPage } from '../pricing/PricingPage';
import { MembersPage } from '../members/MembersPage';
import { useSetupRepositories } from './services';

const tabs = ['Repositories', 'Agent setup', 'Model prices', 'Members', 'Advanced'] as const;
type Tab = typeof tabs[number];
const tabHash = (tab: Tab) => tab.toLowerCase().replaceAll(' ', '-');
const currentTab = () => tabs.find((tab) => `#${tabHash(tab)}` === window.location.hash) ?? 'Repositories';

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>(currentTab);
  useEffect(() => {
    const changed = () => setTab(currentTab());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const [repository, setRepository] = useState(localStorage.getItem('agent-ops-repository') ?? '');
  const { session, repositories } = useSetupRepositories(tab === 'Agent setup');
  const command = `agent-ops watch --repository ${repository || '<repository>'} --token ${sessionStorage.getItem('agent-ops-token') ? '••••••••' : '<token>'}`;
  return <section className="min-w-0 p-4"><h1 className="mb-2 text-2xl font-semibold">Settings</h1><p className="mb-5 text-slate-600">Manage connected repositories, agents, prices and access.</p>
    <nav aria-label="Settings tabs" className="mb-6 flex flex-wrap gap-2">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className="rounded border px-3 py-2" onClick={() => { setTab(item); window.location.hash = tabHash(item); }}>{item}</button>)}</nav>
    {tab === 'Repositories' && <RepositoriesPage />}{tab === 'Model prices' && <PricingPage />}{tab === 'Members' && <MembersPage />}
    {tab === 'Agent setup' && <div className="grid min-w-0 max-w-xl gap-4">
      {session.isPending && <p role="status">Loading setup session…</p>}
      {session.isError && <p role="alert">Unable to load setup session. <button onClick={() => void session.refetch()}>Retry</button></p>}
      {session.data?.organization_id && repositories.isPending && <p role="status">Loading repositories…</p>}
      {repositories.isError && <p role="alert">Unable to load repositories. <button onClick={() => void repositories.refetch()}>Retry</button></p>}
      {repositories.data?.length === 0 && <a className="underline" href="/settings/advanced#repositories">Connect a repository first</a>}
      <label className="grid min-w-0 gap-1">Repository<select aria-label="Repository" className="min-w-0 max-w-full rounded border p-2" value={repository} onChange={(event) => { setRepository(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">Select repository</option>{repositories.data?.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}</select></label>
      <p>Run this command to connect your agent:</p><code className="break-all rounded bg-slate-100 p-3">{command}</code><button className="w-fit rounded border p-2" onClick={() => void navigator.clipboard.writeText(command)}>Copy command</button>
      <a className="underline" href="/#getting-started">Check first session progress</a>
    </div>}
     {tab === 'Advanced' && <nav className="grid max-w-sm gap-2">{[['Batches', '/waves'], ['Agents', '/work'], ['Logs', '/runs'], ['Budgets', '/budgets'], ['Alerts', '/alerts']].map(([label, href]) => <a className="rounded border p-3" key={href} href={href}>{label}</a>)}</nav>}
  </section>;
}
