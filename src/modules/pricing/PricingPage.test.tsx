// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PricingPage } from './PricingPage';
import { api } from '../../shared/api/client';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PricingPage /></QueryClientProvider>);
}

describe('PricingPage', () => {
  it('lists versions and permits owner to create and edit through generated requests', async () => {
    vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { organization_id: 'org-a', account_id: 'acct' } } as never);
    vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role: 'owner' }] } } as never);
    const list = vi.spyOn(api.api, 'v1AgentRunPricesList').mockResolvedValue({ data: { data: [{ id: 'price-1', model: 'model-a', effective_date: '2026-01-01', input_per_million: 1, cached_input_per_million: 0, cache_write_per_million: 0, output_per_million: 2, reasoning_per_million: 0 }] } } as never);
    const create = vi.spyOn(api.api, 'v1AgentRunPricesCreate').mockResolvedValue({ data: {} } as never);
    const update = vi.spyOn(api.api, 'v1AgentRunPricesPartialUpdate').mockResolvedValue({ data: {} } as never);
    renderPage();
    await screen.findByText('model-a');
    expect(list).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'model-b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create version' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'model-b', effective_date: expect.any(String) })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'model-a-v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update version' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('price-1', expect.objectContaining({ model: 'model-a-v2' })));
  });

  it('keeps viewer read-only and displays server errors', async () => {
    vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { organization_id: 'org-a', account_id: 'acct' } } as never);
    vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role: 'viewer' }] } } as never);
    vi.spyOn(api.api, 'v1AgentRunPricesList').mockRejectedValue(new Error('offline'));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    expect(screen.queryByRole('button', { name: 'Create version' })).toBeNull();
    expect(screen.getByText(/only organization owners and admins/)).toBeTruthy();
  });
});
