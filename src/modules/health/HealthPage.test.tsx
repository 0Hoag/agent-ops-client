// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HealthPage } from './HealthPage';

const refetch = vi.fn();
vi.mock('./services/health', () => ({ useHealth: () => ({ isPending: false, isError: true, refetch }) }));

it('offers a readable error and retries the health request', () => {
  render(<HealthPage />);
  expect(screen.getByRole('alert').textContent).toContain('API status unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refetch).toHaveBeenCalledOnce();
});
