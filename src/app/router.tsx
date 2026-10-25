import { Route, Routes } from 'react-router-dom';
import { registerHealth } from './register-health';
import { registerBoard } from './register-board';
import { registerRuns } from './register-runs';
import { registerInsights } from './register-insights';

/** Mounts the route elements exposed by registered feature modules. */
export function AppRouter() {
  const health = registerHealth();
  const board = registerBoard();
  const runs = registerRuns();
  const insights = registerInsights();
  return <Routes><Route path={health.path} element={health.element} /><Route path={board.path} element={board.element} /><Route path={runs.path} element={runs.element} /><Route path={insights.path} element={insights.element} /></Routes>;
}
