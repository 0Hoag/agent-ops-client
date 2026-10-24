import { createRunsModule } from '../modules/runs/module';
import { paths } from './paths';

export function registerRuns() {
  const module = createRunsModule();
  paths.runs = module.path;
  return module;
}
