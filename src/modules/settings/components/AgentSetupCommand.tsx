import { useState } from 'react';
import { getApiBaseUrl } from '../../../shared/env';

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** Builds a supported CLI push command without reading or copying credentials. */
export function setupCommand(repository: string, file: string, harness: string): string {
  const endpoint = new URL(`${getApiBaseUrl().replace(/\/$/, '')}/api/v1/agent-runs`, window.location.origin).href;
  return `: "\${AGENT_RUN_TOKEN:?Set AGENT_RUN_TOKEN to the configured ingestion credential}" && agentops push --harness ${quote(harness)} --endpoint ${quote(endpoint)} --repository-id ${quote(repository)} --wave setup --worker local-agent ${quote(file)}`;
}

/** Keeps ingestion prerequisites explicit and credentials out of the browser. */
export function AgentSetupCommand({ repository }: { repository: string }) {
  const [file, setFile] = useState('');
  const [harness, setHarness] = useState('codex');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const command = repository && file.trim() ? setupCommand(repository, file.trim(), harness) : '';
  const changed = () => { setCopied(false); setError(false); };
  async function copy() {
    setCopied(false); setError(false);
    try { await navigator.clipboard.writeText(command); setCopied(true); }
    catch { setError(true); }
  }
  return <>
    <p>Send a completed transcript to see your agent’s usage and cost.</p>
    <p>Ask your deployment administrator for the configured ingestion credential and permission to use this repository. Export it as <code>AGENT_RUN_TOKEN</code> in your terminal, not here. Your dashboard login is not an ingestion credential. If ingestion is not configured, the administrator must enable it first.</p>
    <p>Install <code>agentops</code> using the <a className="underline" href="https://github.com/0Hoag/agent-ops/blob/main/docs/install.md">CLI installation guide</a>. Run from your repository’s Git checkout with a completed transcript containing model metadata. This sends one transcript, not a background watcher.</p>
    <label className="grid gap-1">Transcript format<select className="rounded border p-2" value={harness} onChange={(event) => { setHarness(event.target.value); changed(); }}><option value="codex">Codex</option><option value="claude">Claude</option><option value="opencode">OpenCode</option></select></label>
    <label className="grid min-w-0 gap-1">Transcript file path<input className="min-w-0 rounded border p-2" value={file} onChange={(event) => { setFile(event.target.value); changed(); }} aria-describedby="transcript-help" /></label>
    <p id="transcript-help">Enter the absolute path on the computer running the CLI. The file is not uploaded by this page. The command labels the batch “setup” and agent “local-agent”.</p>
    {!command && <p>Select a connected repository and enter a transcript path to prepare the command.</p>}
    {command && <code className="break-all rounded bg-slate-100 p-3">{command}</code>}
    <button disabled={!command} className="w-fit rounded border p-2 disabled:opacity-50" onClick={() => void copy()}>Copy command</button>
    {copied && <p role="status">Command copied. Run it in your terminal; copying does not send a transcript.</p>}
    {error && <p role="alert">Unable to copy. Select the command above and copy it manually, or retry Copy command.</p>}
  </>;
}
