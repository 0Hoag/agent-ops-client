import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login } from './services/auth';

export function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      navigate((location.state as { from?: string } | null)?.from ?? '/board', { replace: true });
    } catch {
      setError('Unable to sign in. Check your email and password.');
    } finally {
      setBusy(false);
    }
  }
  return <main className="mx-auto mt-20 max-w-md rounded bg-white p-8 shadow"><h1 className="mb-6 text-2xl font-semibold">Sign in</h1><form className="grid gap-4" onSubmit={submit}><label className="grid gap-1">Email<input className="rounded border p-2" name="email" type="email" autoComplete="username" required /></label><label className="grid gap-1">Password<input className="rounded border p-2" name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="text-rose-700">{error}</p>}<button disabled={busy} className="rounded bg-slate-900 p-2 text-white">{busy ? 'Signing in…' : 'Sign in'}</button></form></main>;
}
