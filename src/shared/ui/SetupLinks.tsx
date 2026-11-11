export function SetupLinks() {
  return <nav aria-label="Setup next steps" className="mt-3 flex flex-wrap gap-3 text-sm">
    <a className="underline" href="/settings/advanced#repositories">Connect a repository</a>
    <a className="underline" href="/settings/advanced#agent-setup">Send the first agent session</a>
    <a className="underline" href="/settings/advanced#model-prices">Set model prices</a>
    <a className="underline" href="/#getting-started">Check setup progress</a>
  </nav>;
}
