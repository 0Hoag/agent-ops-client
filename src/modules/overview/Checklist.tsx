import { useOnboarding } from './services';

export function Checklist({ organizationId }: { organizationId: string }) {
  const query = useOnboarding(organizationId);
  if (query.isPending) return <p role="status">Checking setup progress…</p>;
  if (query.isError) return <p role="alert">Unable to check setup progress: {query.error.message} <button onClick={() => void query.refetch()}>Retry setup check</button></p>;
  const steps = [
    { name: 'Connect a repository', href: '/settings/advanced#repositories', complete: query.data.repository },
    { name: 'Send the first agent session', href: '/settings/advanced#agent-setup', complete: query.data.session },
    { name: 'Set model prices', href: '/settings/advanced#model-prices', complete: query.data.prices },
  ];
  return <section id="getting-started" aria-label="First-run checklist" className="mb-6 rounded border bg-white p-4">
    <h2 className="font-semibold">Getting started</h2>
    <p className="mt-1 text-sm">{steps.filter((step) => step.complete).length} of 3 steps complete</p>
    <ol className="mt-3 grid gap-3 sm:grid-cols-3">{steps.map((step) => <li key={step.name} className="min-w-0 rounded border p-3">
      <p className="mb-2 text-sm">{step.complete ? 'Complete' : 'Not complete'}</p>
      <a className="inline-block rounded border px-3 py-2 text-blue-700 underline" href={step.href}>{step.name}</a>
    </li>)}</ol>
  </section>;
}
