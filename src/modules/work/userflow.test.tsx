// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkPage } from './page';

vi.mock('./services', () => ({
  useWorkRepositories: () => ({ data: [{ id: 'repo-185', full_name: 'userflows/project', provider: 'gitlab', gitlab_base_url: 'https://gitlab.example.invalid/' }] }),
  useWork: () => ({ data: { data: [{ kind: 'pr', number: 1, title: 'Ranked MR', cost_usd: 17 }] } }),
  useWorkDetail: () => ({ data: { item: { title: 'Ranked MR' }, runs: [{ id: 'one', model: 'alpha', cost_usd: 17, tokens: 100 }] } }),
}));

afterEach(() => { cleanup(); history.replaceState(null, '', '/'); localStorage.clear(); });

it('opens the repository and selected MR from an expensive-MR deep link', () => {
  history.replaceState(null, '', '/work?repository=repo-185&pr=1');
  render(<WorkPage />);
  expect(screen.getByLabelText('Repository')).toHaveProperty('value', 'repo-185');
  expect(screen.getByRole('heading', { name: 'Ranked MR' })).toBeTruthy();
  expect(screen.getByText('$17.00 USD · 100 tokens')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open in GitLab' }).getAttribute('href')).toBe('https://gitlab.example.invalid/userflows/project/-/merge_requests/1');
});
