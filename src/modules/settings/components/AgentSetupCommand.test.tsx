// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentSetupCommand, setupCommand } from './AgentSetupCommand';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('builds a quoted Claude setup command with configured endpoint and no credential', () => {
  vi.stubEnv('APP_API_URL', 'https://ingest.example.test');
  const command = setupCommand("repo' $(bad)");
  expect(command).toContain("--repository-id 'repo'\\'' $(bad)'");
  expect(command).toContain("--endpoint 'https://ingest.example.test/api/v1/agent-runs'");
  expect(command).toContain('agentops setup claude');
  expect(command).not.toMatch(/token|secret/i);
});

it('shows prerequisites, empty state, and copy success/failure', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { rerender } = render(<AgentSetupCommand repository="" />);
  expect(screen.getByText(/Select a connected repository/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Copy setup command' }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<AgentSetupCommand repository="repo-a" />);
  expect(screen.getByText(/Install the/)).toBeTruthy();
  expect(screen.getByText(/Ask your deployment administrator/)).toBeTruthy();
  expect(screen.getByText(/start Claude Code in this repository/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy setup command' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy setup command' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(writeText).toHaveBeenLastCalledWith(setupCommand('repo-a'));
});
