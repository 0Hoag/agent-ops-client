import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { registerHealth } from './register-health';
import { registerBoard } from './register-board';
import { registerRuns } from './register-runs';
import { registerInsights } from './register-insights';
import { LoginPage } from '../modules/auth/LoginPage';
import { hasToken, validateSession } from '../modules/auth/services/auth';
import { paths } from './paths';

function Protected({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [valid, setValid] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hasToken()) { setValid(false); return; }
    void validateSession().then((ok) => {
      setValid(ok);
      if (!ok) void queryClient.clear();
    });
  }, [location.pathname, queryClient]);
  return valid ? children : valid === false ? <Navigate to={paths.login} state={{ from: location.pathname }} replace /> : <p role="status">Checking session…</p>;
}

/** Mounts the route elements exposed by registered feature modules. */
export function AppRouter() {
  const health = registerHealth();
  const board = registerBoard();
  const runs = registerRuns();
  const insights = registerInsights();
  return <Routes><Route path={health.path} element={health.element} /><Route path={paths.login} element={<LoginPage />} /><Route path={board.path} element={<Protected>{board.element}</Protected>} /><Route path={runs.path} element={<Protected>{runs.element}</Protected>} /><Route path={insights.path} element={<Protected>{insights.element}</Protected>} /><Route path="*" element={<Navigate to={paths.health} replace />} /></Routes>;
}
