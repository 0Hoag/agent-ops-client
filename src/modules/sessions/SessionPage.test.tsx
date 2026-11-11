// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { SessionPage } from './SessionPage';
import { mergeRequestUrl, pricedSteps, total } from './format';
import { Sessions } from '../usage/Evidence';

const requests = vi.spyOn(http, 'request');
let organization = 'org-a';
let mode = 'data';
const run = { id: 'private-run', session_id: 'private-session', repository_id: 'private-repo', harness: 'Claude', branch: 'feat/detail', model: 'Sonnet', started_at: '2026-11-11T10:00:00Z', cost_usd: 4, pr_number: 42 };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/usage/sessions?run=private-run&repository=private-repo']}><SessionPage /></MemoryRouter></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  organization = 'org-a'; mode = 'data';
  requests.mockImplementation((config) => {
    const url = new URL(config.url!, 'http://fixture');
    if (mode === 'error' && url.pathname.endsWith('/agent-runs')) return Promise.reject(new Error('offline'));
    if (mode === 'loading' && url.pathname.endsWith('/agent-runs')) return new Promise<never>(() => {});
    const data = url.pathname.endsWith('/session') ? { organization_id: organization }
      : url.pathname.endsWith('/repositories') ? { data: [{ id: 'private-repo', provider: 'gitlab', gitlab_base_url: 'https://git.example.com', full_name: 'team/widgets' }] }
      : url.pathname.endsWith('/timeline') ? { data: { steps: mode === 'missing' ? [{}] : [
        { sequence: 2, tool_name: 'Run tests', cumulative_cost_usd: 4, cache_hit: false, input_tokens: 1200, started_at: run.started_at },
        { sequence: 1, tool_name: 'Read files', cumulative_cost_usd: 1, cache_hit: true, input_tokens: 1000, started_at: run.started_at },
      ] } }
      : { data: organization === 'org-b' || mode === 'empty' ? [] : mode === 'missing' ? [{ ...run, cost_usd: undefined }] : [run, { ...run, id: 'second-run', cost_usd: 2 }, { ...run, id: 'unrelated', session_id: 'other', cost_usd: 100 }] };
    return Promise.resolve({ data, status: 200, headers: {}, config } as never);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('links an unavailable session to ingestion and live setup progress', async () => {
  mode = 'empty'; setup();
  await screen.findByText(/not available in the current organization/);
  expect(screen.getByRole('link', { name: 'Send the first agent session' }).getAttribute('href')).toBe('/settings/advanced#agent-setup');
  expect(screen.getByRole('link', { name: 'Check setup progress' }).getAttribute('href')).toBe('/#getting-started');
});
it('opens detail from Usage using internal identifiers only', () => {
  render(<Sessions runs={[run]} />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/usage/sessions?run=private-run&repository=private-repo');
  expect(document.body.textContent).not.toContain('private-');
});
it('explains actual session cost, real MR URL, sorted tools, incremental expensive steps and cache trend', async () => {
  setup();
  await screen.findByText('$6.00 · USD');
  expect((await screen.findByRole('link', { name: 'team/widgets · MR #42' })).getAttribute('href')).toBe('https://git.example.com/team/widgets/-/merge_requests/42');
  await screen.findAllByText('Step 1 · Read files');
  expect(screen.getAllByText('Highest cost')).toHaveLength(2);
  expect(screen.getAllByText(/50% \(1\/2 reported steps\)/)).toHaveLength(2);
  expect(screen.getAllByText(/Input 1.2K/)).toHaveLength(2);
  expect(screen.getAllByRole('meter')[1].getAttribute('value')).toBe('50');
  expect(screen.getAllByText('Step 2 · Run tests')[0].parentElement?.textContent).toContain('$3.00');
  expect(document.body.textContent).not.toContain('private-');
  expect(document.querySelector('time')?.title).toBe(new Date(run.started_at).toLocaleString());
});
it('hides previous tenant immediately and keys queries by validated organization', async () => {
  const client = setup(); await screen.findByText('$6.00 · USD');
  act(() => window.dispatchEvent(new Event('organization:will-change')));
  expect(screen.queryByText('$6.00 · USD')).toBeNull();
  organization = 'org-b';
  act(() => window.dispatchEvent(new Event('organization:changed')));
  await screen.findByText(/not available in the current organization/);
  expect(screen.queryByText('Claude')).toBeNull();
  expect(client.getQueryCache().getAll().some((query) => query.queryKey[0] === 'session-detail' && query.queryKey[1] === 'org-b')).toBe(true);
});
it('handles loading, retry and empty session states', async () => {
  mode = 'loading'; setup(); await screen.findByText('Loading session costs…'); cleanup();
  mode = 'error'; setup(); await screen.findByRole('alert');
  mode = 'empty'; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('link', { name: 'Choose a session in Usage' });
});
it('does not invent zero when cost or telemetry is missing', async () => {
  mode = 'missing'; setup();
  await screen.findAllByText(/Cost unavailable — configure model pricing/);
  await waitFor(() => expect(screen.getByText(/Cumulative hit rate unavailable/)).toBeTruthy());
  expect(document.body.textContent).not.toContain('$0.00');
});
it('uses provider metadata and preserves unavailable cumulative deltas', () => {
  expect(mergeRequestUrl({ full_name: 'team/repo' }, 1)).toBeUndefined();
  expect(mergeRequestUrl({ full_name: 'team/repo', provider: 'github' }, 1)).toBe('https://github.com/team/repo/pull/1');
  expect(mergeRequestUrl({ full_name: 'team/repo', provider: 'gitlab', gitlab_base_url: 'javascript:alert(1)' }, 1)).toBeUndefined();
  expect(pricedSteps([{ sequence: 1 }, { sequence: 2, cumulative_cost_usd: 4 }])[1].cost).toBeUndefined();
  expect(total([1, undefined])).toBeUndefined();
});
