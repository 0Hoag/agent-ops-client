// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MergeRequests } from './Evidence';

afterEach(cleanup);

it('links the highest recorded-cost MR to its repository-scoped Work details', () => {
  render(<MergeRequests repositoryName={() => 'userflows/project'} runs={[
    { repository_id: 'repo-185', pr_number: 2, cost_usd: 1 },
    { repository_id: 'repo-185', pr_number: 1, cost_usd: 12.4 },
    { repository_id: 'repo-185', pr_number: 1, cost_usd: 4.6 },
  ]} />);
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/work?repository=repo-185&pr=1');
  expect(screen.getAllByRole('link')[0].textContent).toContain('MR #1');
  expect(screen.getByText('$17.00')).toBeTruthy();
});
