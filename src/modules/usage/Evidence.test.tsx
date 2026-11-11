// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MergeRequests } from './Evidence';

afterEach(cleanup);
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
