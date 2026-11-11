import { Navigate } from 'react-router-dom';
import { paths } from './paths';

export function registerRuns() {
  const module = { path: '/runs', element: <Navigate to="/usage" replace /> };
  paths.runs = module.path;
  return module;
}
