import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listOrganizations, login, selectOrganization } from './services/auth';
import type { Organization } from './services/auth';

export function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [selected, setSelected] = useState('');
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? '/board';
  function finish() { navigate(destination, { replace: true }); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await login(String(form.get('email')), String(form.get('password')));
      if (result.organizationId) finish();
      else setOrganizations(await listOrganizations());
    } catch { setError('Unable to sign in or load organizations. Check your credentials and try again.'); }
    finally { setBusy(false); }
  }
  async function chooseOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setSwitching(true); setError('');
    try {
      await selectOrganization(selected);
      window.dispatchEvent(new Event('organization:changed'));
      finish();
    }
    catch { setError('Unable to select this organization. Your session is unchanged; try again.'); }
    finally { setSwitching(false); }
  }
  return <main className="mx-auto mt-20 max-w-md rounded bg-white p-8 shadow"><h1 className="mb-6 text-2xl font-semibold">{organizations ? 'Select an organization' : 'Sign in'}</h1>{organizations ? <form className="grid gap-4" onSubmit={chooseOrganization}><label className="grid gap-1">Organization<select aria-label="Organization" className="rounded border p-2" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={switching}><option value="">Select an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>{organizations.length === 0 && <p>No organizations are available for this account.</p>}{error && <p role="alert" className="text-rose-700">{error}</p>}<button type="submit" disabled={switching || !selected} className="rounded bg-slate-900 p-2 text-white">{switching ? 'Selecting…' : 'Continue'}</button></form> : <form className="grid gap-4" onSubmit={submit}><label className="grid gap-1">Email<input className="rounded border p-2" name="email" type="email" autoComplete="username" required /></label><label className="grid gap-1">Password<input className="rounded border p-2" name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="text-rose-700">{error}</p>}<button disabled={busy} className="rounded bg-slate-900 p-2 text-white">{busy ? 'Signing in…' : 'Sign in'}</button></form>}</main>;
}
