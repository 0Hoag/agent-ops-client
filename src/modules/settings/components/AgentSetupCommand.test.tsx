// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentSetupCommand, setupCommand } from './AgentSetupCommand';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it.each(['', '/api-proxy', 'https://ingest.example.test'])('uses the configured API base %s and quotes shell inputs', (base) => {
  vi.stubEnv('APP_API_URL', base);
  const command = setupCommand('repository', "/sessions/it's $(touch bad).jsonl", 'codex');
  expect(command).toContain(new URL(`${base}/api/v1/agent-runs`, window.location.origin).href);
  expect(command).toContain("'/sessions/it'\\''s $(touch bad).jsonl'");
  expect(command).toContain('${AGENT_RUN_TOKEN:?');
  expect(command).not.toMatch(/--token|••••|<token>/);
});

it('copies only the prepared command and reports clipboard failures honestly', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { rerender } = render(<AgentSetupCommand repository="repo-a" />);
  fireEvent.change(screen.getByLabelText('Transcript file path'), { target: { value: '/tmp/session.jsonl' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(writeText).toHaveBeenLastCalledWith(setupCommand('repo-a', '/tmp/session.jsonl', 'codex'));
  rerender(<AgentSetupCommand repository="" />);
  expect((screen.getByRole('button', { name: 'Copy command' }) as HTMLButtonElement).disabled).toBe(true);
});
