// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CostList, MergeRequests, Sessions } from './Evidence';

afterEach(cleanup);
it('offers pricing and session linkage setup when no merge requests can be ranked, without inventing cost', () => {
  render(<MergeRequests repositoryName={() => 'team/widgets'} runs={[{ pr_number: 1 }, { model: 'unpriced' }]} />);
  expect(screen.getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
  expect(screen.getByRole('link', { name: 'Connect sessions' }).getAttribute('href')).toBe('/settings/advanced#agent-setup');
  expect(screen.getByText(/No priced merge requests/)).toBeTruthy();
  expect(screen.queryByText('$0.00')).toBeNull();
});
it('offers session setup when sessions have no merge request linkage', () => {
  render(<MergeRequests repositoryName={() => 'team/widgets'} runs={[{ cost_usd: 2 }]} />);
  expect(screen.getByRole('link', { name: 'Connect sessions' }).getAttribute('href')).toBe('/settings/advanced#agent-setup');
  expect(screen.getByText(/No priced merge requests/)).toBeTruthy();
});
it('keeps missing split and recorded session costs unavailable, even for a priced model', () => {
  render(<><CostList rows={[{ name: 'priced-model' }]} /><Sessions runs={[{ id: 'session', model: 'priced-model' }]} /></>);
  expect(screen.getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
  expect(screen.getByRole('table').textContent).toContain('Cost unavailable');
  expect(screen.queryByText('$0.00')).toBeNull();
});
it('ranks five merge requests by all attributed runs, excluding incomplete costs with an explanation', () => {
  render(<MergeRequests repositoryName={() => 'team/widgets'} runs={[
    ...Array.from({ length: 7 }, (_, index) => ({ pr_number: index + 1, cost_usd: index + 1 })),
    { pr_number: 1, cost_usd: 20 }, { pr_number: 7 },
  ]} />);
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(5);
  expect(items[0].textContent).toBe('team/widgets · MR #1$21.00');
  expect(items[1].textContent).toBe('team/widgets · MR #6$6.00');
  expect(screen.queryByText('team/widgets · MR #7')).toBeNull();
  expect(screen.getByText(/Some merge requests cannot be ranked/)).toBeTruthy();
});
