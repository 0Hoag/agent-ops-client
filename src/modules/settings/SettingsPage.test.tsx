// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { http } from '../../shared/http';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.spyOn(http, 'request').mockImplementation(async (config) => ({ data: config.url?.includes('/auth/session') ? { organization_id: 'org-a' } : { data: [] }, status: 200 }));
  });
  afterEach(() => { cleanup(); window.location.hash = ''; vi.restoreAllMocks(); localStorage.clear(); });

  it('loads connected repositories for the ingestion destination and generates its command', async () => {
    window.location.hash = 'agent-setup';
    vi.spyOn(http, 'request').mockImplementation(async (config) => ({
      data: config.url?.includes('/auth/session') ? { organization_id: 'org-a' } : { data: [{ id: 'repo-a', full_name: 'team/widgets' }] }, status: 200,
    }));
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
    await screen.findByRole('option', { name: 'team/widgets' });
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-a' } });
    expect(screen.getByText(/agent-ops watch --repository repo-a/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Check first session progress' }).getAttribute('href')).toBe('/#getting-started');
  });

  it.each([['agent-setup', 'Agent setup'], ['model-prices', 'Model prices'], ['repositories', 'Repositories']])('opens the %s deep link', (hash, name) => {
    window.location.hash = hash;
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
    expect(screen.getByRole('tab', { name, selected: true })).toBeTruthy();
  });

  it('opens Advanced and exposes the Alerts destination', () => {
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);

    expect(screen.queryByRole('link', { name: /^Alerts$/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /^Advanced$/ }));

    expect(screen.getByRole('link', { name: /^Alerts$/ }).getAttribute('href')).toBe('/alerts');
  });

  it('provides a labelled tablist, roving focus and an associated panel', () => {
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
    const first = screen.getByRole('tab', { name: 'Repositories' });
    expect(screen.getByRole('tablist', { name: 'Settings tabs' }).contains(first)).toBe(true);
    expect(first.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: 'Agent setup' }).tabIndex).toBe(-1);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    const advanced = screen.getByRole('tab', { name: 'Advanced', selected: true });
    expect(document.activeElement).toBe(advanced);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(advanced.id);
    expect(advanced.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    fireEvent.keyDown(advanced, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Agent setup', selected: true }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(advanced);
  });
});
