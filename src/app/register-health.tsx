import { paths } from './paths';
import { createHealthModule } from '../modules/health/module';

/** Registers the health module's canonical route path. */
export function registerHealth() {
  const module = createHealthModule();
  paths.health = module.path;
  return module;
}
