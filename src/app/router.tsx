import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { registerHealth } from './register-health';
import { registerSessions } from './register-sessions';
import { registerBoard } from './register-board';
import { registerRuns } from './register-runs';
import { registerInsights } from './register-insights';
import { registerMembers } from './register-members';
import { registerRepositories } from './register-repositories';
import { registerPricing } from './register-pricing';
import { registerBudgets } from './register-budgets';
import { registerAlerts } from './register-alerts';
import { registerWaves } from './register-waves';
import { registerOverview } from './register-overview';
import { registerWork } from './register-work';
import { InvitationPage } from '../modules/members/InvitationPage';
import { membersPaths } from '../modules/members/paths';
import { LoginPage } from '../modules/auth/LoginPage';
import { hasToken, validateSession } from '../modules/auth/services/auth';
import { paths } from './paths';
import { UiShowcase } from './UiShowcase';
import { SettingsPage } from '../modules/settings/SettingsPage';

function Protected({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<{ path: string; state: 'valid' | 'denied' | 'retry' } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const state = session?.path === location.pathname ? session.state : null;
  useEffect(() => {
    let active = true;
    const deny = () => { active = false; setSession({ path: location.pathname, state: 'denied' }); queryClient.clear(); };
    window.addEventListener('auth:unauthorized', deny);
    if (!hasToken()) deny();
    else {
      void validateSession((organizationId) => {
        if (active) window.dispatchEvent(new CustomEvent('auth:session-restored', { detail: { organizationId } }));
      }).then((ok) => {
        if (!active) return;
        setSession({ path: location.pathname, state: ok ? 'valid' : 'denied' });
        if (!ok) queryClient.clear();
      }).catch(() => {
        if (active) setSession({ path: location.pathname, state: 'retry' });
      });
    }
    return () => { active = false; window.removeEventListener('auth:unauthorized', deny); };
  }, [location.pathname, queryClient, attempt]);
  return state === 'valid' ? children : state === 'denied' ? <Navigate to={paths.login} state={{ from: location.pathname + location.search + location.hash }} replace /> : state === 'retry' ? <section role="alert"><p>Unable to verify your session. Check your connection and try again.</p><button onClick={() => setAttempt((value) => value + 1)}>Retry</button></section> : <p role="status">Checking session…</p>;
}

/** Mounts the route elements exposed by registered feature modules. */
export function AppRouter() {
  const health = registerHealth();
  const sessions = registerSessions();
  const overview = registerOverview();
  const work = registerWork();
  const board = registerBoard();
  const runs = registerRuns();
  const insights = registerInsights();
  const members = registerMembers();
  const repositories = registerRepositories();
  const pricing = registerPricing();
  const budgets = registerBudgets();
  const alerts = registerAlerts();
  const waves = registerWaves();
  const location = useLocation();
  if (location.pathname === sessions.path) return <Routes><Route path={sessions.path} element={<Protected>{sessions.element}</Protected>} /></Routes>;
  return <Routes><Route path={work.path} element={<Protected>{work.element}</Protected>} />{process.env.NODE_ENV !== 'production' && <Route path="/ui" element={<UiShowcase />} />}<Route path="/insights" element={<Navigate to={insights.path} replace />} /><Route path={overview.path} element={<Protected>{overview.element}</Protected>} /><Route path={paths.login} element={<LoginPage />} /><Route path={membersPaths.invite} element={<Protected><InvitationPage /></Protected>} /><Route path={paths.advanced} element={<Protected><SettingsPage /></Protected>} /><Route path={members.path} element={<Protected>{members.element}</Protected>} /><Route path={repositories.path} element={<Protected>{repositories.element}</Protected>} /><Route path={pricing.path} element={<Protected>{pricing.element}</Protected>} /><Route path={budgets.path} element={<Protected>{budgets.element}</Protected>} /><Route path={alerts.path} element={<Protected>{alerts.element}</Protected>} /><Route path={health.path} element={<Protected>{health.element}</Protected>} /><Route path={waves.path} element={<Protected>{waves.element}</Protected>} /><Route path={board.path} element={<Protected>{board.element}</Protected>} /><Route path={runs.path} element={<Protected>{runs.element}</Protected>} /><Route path={insights.path} element={<Protected>{insights.element}</Protected>} /><Route path="*" element={<Navigate to={paths.board} replace />} /></Routes>;
}
