import { useState } from 'react';
import { RepositoriesPage } from '../repositories/page';
import { PricingPage } from '../pricing/PricingPage';
import { MembersPage } from '../members/MembersPage';

const tabs = ['Repositories', 'Agent setup', 'Model prices', 'Members', 'Advanced'] as const;
type Tab = typeof tabs[number];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Repositories');
  const [repository, setRepository] = useState(localStorage.getItem('agent-ops-repository') ?? '');
  const command = `agent-ops watch --repository ${repository || '<repository>'} --token ${sessionStorage.getItem('agent-ops-token') ? '••••••••' : '<token>'}`;
  return <section className="min-w-0 p-4"><h1 className="mb-2 text-2xl font-semibold">Settings</h1><p className="mb-5 text-slate-600">Manage connected repositories, agents, prices and access.</p>
    <nav aria-label="Settings tabs" className="mb-6 flex flex-wrap gap-2">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className="rounded border px-3 py-2" onClick={() => setTab(item)}>{item}</button>)}</nav>
    {tab === 'Repositories' && <RepositoriesPage />}{tab === 'Model prices' && <PricingPage />}{tab === 'Members' && <MembersPage />}
    {tab === 'Agent setup' && <div className="grid max-w-xl gap-4"><label>Repository<select aria-label="Repository" className="ml-2 rounded border p-2" value={repository} onChange={(event) => { setRepository(event.target.value); localStorage.setItem('agent-ops-repository', event.target.value); }}><option value="">Select repository</option></select></label><p>Run this command to connect your agent:</p><code className="break-all rounded bg-slate-100 p-3">{command}</code><button className="w-fit rounded border p-2" onClick={() => void navigator.clipboard.writeText(command)}>Copy command</button><p role="status">Waiting for first session</p></div>}
    {tab === 'Advanced' && <nav className="grid max-w-sm gap-2">{[['Waves', '/waves'], ['Workers', '/work'], ['Logs', '/runs'], ['Budgets', '/budgets'], ['Alerts destinations', '/alerts']].map(([label, href]) => <a className="rounded border p-3" key={href} href={href}>{label}</a>)}</nav>}
  </section>;
}
