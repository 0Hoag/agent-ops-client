// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  afterEach(cleanup);

  it('opens Advanced and exposes the Alerts destination', () => {
    render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);

    expect(screen.queryByRole('link', { name: /^Alerts$/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /^Advanced$/ }));

    expect(screen.getByRole('link', { name: /^Alerts$/ }).getAttribute('href')).toBe('/alerts');
  });
});
