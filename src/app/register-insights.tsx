import { registerUsage } from './register-usage';
import { paths } from './paths';

export function registerInsights() {
  const module = registerUsage();
  paths.insights = module.path;
  return module;
}
