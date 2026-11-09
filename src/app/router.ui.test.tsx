// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './router';

vi.mock('./register-health', () => ({ registerHealth: () => ({ path: '/health', element: <p>Health route</p> }) }));
vi.mock('./register-board', () => ({ registerBoard: () => ({ path: '/board', element: <p>Board route</p> }) }));
vi.mock('./register-runs', () => ({ registerRuns: () => ({ path: '/runs', element: <p>Runs route</p> }) }));
vi.mock('./register-insights', () => ({ registerInsights: () => ({ path: '/insights', element: <p>Insights route</p> }) }));
vi.mock('./register-members', () => ({ registerMembers: () => ({ path: '/members', element: <p>Members route</p> }) }));
vi.mock('./register-repositories', () => ({ registerRepositories: () => ({ path: '/repositories', element: <p>Repositories route</p> }) }));
vi.mock('./register-pricing', () => ({ registerPricing: () => ({ path: '/pricing', element: <p>Pricing route</p> }) }));
vi.mock('./register-budgets', () => ({ registerBudgets: () => ({ path: '/budgets', element: <p>Budgets route</p> }) }));
vi.mock('./register-alerts', () => ({ registerAlerts: () => ({ path: '/alerts', element: <p>Alerts route</p> }) }));
vi.mock('./register-waves', () => ({ registerWaves: () => ({ path: '/waves', element: <p>Waves route</p> }) }));
vi.mock('../modules/members/InvitationPage', () => ({ InvitationPage: () => <p>Invite route</p> }));
vi.mock('../modules/auth/LoginPage', () => ({ LoginPage: () => <p>Login route</p> }));
vi.mock('../modules/auth/services/auth', () => ({ hasToken: () => false, validateSession: vi.fn() }));

afterEach(cleanup);

it('exposes the UI showcase outside production and redirects its route in production', () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/ui']}><AppRouter /></MemoryRouter></QueryClientProvider>);
  if (process.env.NODE_ENV !== 'production') expect(screen.getByRole('heading', { name: 'Design system' })).toBeTruthy();
  else expect(screen.getByText('Health route')).toBeTruthy();
});
