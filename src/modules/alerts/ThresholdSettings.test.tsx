// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../shared/api/client';
import { ThresholdSettings } from './ThresholdSettings';

const values = { min_cache_hit: 0.8, silent_seconds: 300, pr_stale_seconds: 86400 };
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}><ThresholdSettings organizationId="org-a" /></QueryClientProvider>); }
function membership(role = 'owner') {
  vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { account_id: 'acct' } } as never);
  vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role }] } } as never);
  vi.spyOn(api.api, 'v1AlertsThresholdsList').mockResolvedValue({ data: values } as never);
}
describe('alert threshold settings', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('loads and saves exact values, validates bounds, and exposes API failures', async () => {
    membership();
    const update = vi.spyOn(api.api, 'v1AlertsThresholdsUpdate').mockRejectedValueOnce(new Error('denied')).mockResolvedValue({ data: values } as never);
    mount();
    const cache = await screen.findByLabelText('Minimum cache-hit rate (%)') as HTMLInputElement;
    expect(cache.value).toBe('0.8');
    fireEvent.change(cache, { target: { value: '1.2' } }); fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }));
    expect((await screen.findByRole('alert')).textContent).toContain('between 0 and 1'); expect(update).not.toHaveBeenCalled();
    fireEvent.change(cache, { target: { value: '0.82' } }); fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }));
    expect((await screen.findByRole('alert')).textContent).toContain('denied');
    fireEvent.click(screen.getByRole('button', { name: 'Save thresholds' }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith({ min_cache_hit: 0.82, silent_seconds: 300, pr_stale_seconds: 86400 }));
  });
  it('keeps member/viewer and unknown membership read-only', async () => {
    membership('viewer'); mount(); await screen.findByLabelText('Minimum cache-hit rate (%)');
    expect(screen.queryByRole('button', { name: 'Save thresholds' })).toBeNull();
  });
  it('does not treat an unverifiable membership as editable', async () => {
    vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { account_id: 'acct' } } as never);
    vi.spyOn(api.api, 'v1OrganizationsMembersList').mockRejectedValue(new Error('offline'));
    vi.spyOn(api.api, 'v1AlertsThresholdsList').mockResolvedValue({ data: values } as never);
    mount(); expect((await screen.findByRole('alert')).textContent).toMatch(/verify organization permissions/);
    expect(screen.queryByRole('button', { name: 'Save thresholds' })).toBeNull();
  });
  it('clears old values and ignores an old organization response during switch', async () => {
    membership();
    let resolveOld!: (value: { data: typeof values }) => void;
    const get = vi.spyOn(api.api, 'v1AlertsThresholdsList').mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }) as never).mockResolvedValue({ data: { min_cache_hit: 0.9, silent_seconds: 600, pr_stale_seconds: 172800 } } as never);
    mount();
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByDisplayValue('0.8')).toBeNull();
    resolveOld({ data: values });
    fireEvent(window, new Event('organization:changed'));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue('0.9')).toBeTruthy();
    expect(screen.getByDisplayValue('600')).toBeTruthy();
  });
});
