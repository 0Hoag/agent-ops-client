import { useState } from 'react';
import { getApiBaseUrl } from '../../../shared/env';

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export function setupCommand(repository: string): string {
  const endpoint = new URL(`${getApiBaseUrl().replace(/\/$/, '')}/api/v1/agent-runs`, window.location.origin).href;
  return `agentops setup claude --repository-id ${quote(repository)} --endpoint ${quote(endpoint)}`;
}

export function AgentSetupCommand({ repository }: { repository: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const command = repository ? setupCommand(repository) : '';
  async function copy() {
    setCopied(false); setError(false);
    try { await navigator.clipboard.writeText(command); setCopied(true); }
    catch { setError(true); }
  }
  return <section className="grid gap-3">
    <h2 className="text-lg font-semibold">Set up Claude Code for this repository</h2>
    <p>This setup applies to Claude Code sessions launched from the selected repository checkout. You do not need to find or enter a transcript path.</p>
    <ol className="list-inside list-decimal">
      <li>Install the <a className="underline" href="https://github.com/0Hoag/agent-ops/blob/main/docs/install.md">AgentOps CLI</a>.</li>
      <li>Ask your deployment administrator for an ingestion token.</li>
      <li>Set <code>AGENT_RUN_TOKEN</code> in your terminal environment.</li>
      <li>Run the setup command, then start Claude Code in this repository.</li>
    </ol>
    {!repository && <p>Select a connected repository to prepare the setup command.</p>}
    {command && <code className="break-all rounded bg-slate-100 p-3">{command}</code>}
    <button disabled={!command} className="w-fit rounded border p-2 disabled:opacity-50" onClick={() => void copy()}>Copy setup command</button>
    {copied && <p role="status">Command copied. Run it in your terminal. After your first Claude Code session, check the Runs page to verify it was ingested.</p>}
    {error && <p role="alert">Unable to copy. Select the command above and copy it manually, or retry.</p>}
    <p>If the first run does not appear, confirm the CLI is installed, the token is set in that terminal, and ask your administrator to check ingestion configuration. For ingestion errors, share the CLI error with your administrator; the dashboard cannot inspect your local terminal.</p>
  </section>;
}
