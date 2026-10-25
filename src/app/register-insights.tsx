import { createInsightsModule } from '../modules/insights/module';
import { paths } from './paths';

export function registerInsights() {
  const module = createInsightsModule();
  paths.insights = module.path;
  return module;
}
