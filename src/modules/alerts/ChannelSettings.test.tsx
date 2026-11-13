// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../shared/api/client';
import { ChannelSettings } from './ChannelSettings';

function mount(organizationId = 'org-a') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ChannelSettings organizationId={organizationId} /></QueryClientProvider>);
}
function setup(role = 'owner', channels: { kind: string; enabled: boolean; slack_webhook_url_env_ref?: string }[] = []) {
  vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { account_id: 'acct' } } as never);
  vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role }] } } as never);
  vi.spyOn(api.api, 'v1AlertsChannelsList').mockResolvedValue({ data: { status: 200, data: channels } } as never);
}
describe('notification channel settings', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('shows only the selected provider and drops unrelated draft references', async () => {
    setup();
    const create = vi.spyOn(api.api, 'v1AlertsChannelsCreate').mockResolvedValue({} as never);
    mount();
    fireEvent.change(await screen.findByLabelText('Slack webhook URL reference'), { target: { value: 'OLD_SLACK' } });
    expect(screen.queryByLabelText('Email server reference')).toBeNull();
    fireEvent.change(screen.getByLabelText('Notification method'), { target: { value: 'smtp' } });
    expect(screen.queryByLabelText('Slack webhook URL reference')).toBeNull();
    expect(screen.queryByLabelText('Telegram token reference')).toBeNull();
    fireEvent.change(screen.getByLabelText('Email server reference'), { target: { value: 'MAIL_HOST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create channel' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'smtp', smtp_host_env_ref: 'MAIL_HOST' })));
    expect(create.mock.calls[0][0]).not.toHaveProperty('slack_webhook_url_env_ref');
    fireEvent.change(screen.getByLabelText('Notification method'), { target: { value: 'telegram' } });
    expect(screen.getByLabelText('Telegram token reference')).toBeTruthy();
    expect(screen.queryByLabelText('Email server reference')).toBeNull();
  });
  it('creates, edits, toggles, and deletes environment references without exposing values', async () => {
    setup();
    let saved: { kind: string; enabled: boolean; slack_webhook_url_env_ref?: string }[] = [];
    vi.spyOn(api.api, 'v1AlertsChannelsList').mockImplementation(async () => ({ data: { status: 200, data: saved } } as never));
    vi.spyOn(api.api, 'v1AlertsChannelsCreate').mockImplementation(async (body) => { saved = [{ kind: body.kind ?? '', enabled: body.enabled ?? false, slack_webhook_url_env_ref: body.slack_webhook_url_env_ref }]; return { data: saved[0] } as never; });
    const update = vi.spyOn(api.api, 'v1AlertsChannelsUpdate').mockImplementation(async (kind, body) => { saved = [{ kind, enabled: body.enabled ?? false, slack_webhook_url_env_ref: body.slack_webhook_url_env_ref }]; return { data: saved[0] } as never; });
    const remove = vi.spyOn(api.api, 'v1AlertsChannelsDelete').mockImplementation(async () => { saved = []; return {} as never; });
    mount();
    expect(await screen.findByLabelText('Slack webhook URL reference')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Slack webhook URL reference'), { target: { value: 'SLACK_ALERT_URL' } });
    expect(screen.queryByLabelText(/_env_ref$/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create channel' }));
    await waitFor(() => expect(api.api.v1AlertsChannelsCreate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'slack', slack_webhook_url_env_ref: 'SLACK_ALERT_URL' })));
    expect(screen.queryByText(/token-value/i)).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disable' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('slack', expect.objectContaining({ enabled: false })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Slack webhook URL reference'), { target: { value: 'ROTATED_SLACK_URL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('slack', expect.objectContaining({ slack_webhook_url_env_ref: 'ROTATED_SLACK_URL' })));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('slack'));
  });
  it('keeps viewer read-only and displays API errors', async () => {
    setup('viewer', [{ kind: 'slack', enabled: true }]); mount();
    expect(await screen.findByText('Read-only: owner or admin access required.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Disable' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Create channel' })).toBeNull();
  });
  it('renders API write errors', async () => {
    setup(); vi.spyOn(api.api, 'v1AlertsChannelsCreate').mockRejectedValue(new Error('fixture denied'));
    mount(); fireEvent.change(await screen.findByLabelText('Slack webhook URL reference'), { target: { value: 'SLACK_ALERT_URL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create channel' }));
    expect((await screen.findByRole('alert')).textContent).toContain('fixture denied');
  });
  it('clears draft and errors during organization changes', async () => {
    setup(); mount();
    fireEvent.change(await screen.findByLabelText('Slack webhook URL reference'), { target: { value: 'OLD_ORG_REF' } });
    fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByDisplayValue('OLD_ORG_REF')).toBeNull();
    fireEvent(window, new Event('organization:changed'));
    await waitFor(() => expect(screen.getByLabelText('Slack webhook URL reference')).toBeTruthy());
  });
});
