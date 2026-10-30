import { createWavesModule } from '../modules/waves/module';
import { paths } from './paths';

export function registerWaves() {
  const module = createWavesModule();
  paths.waves = module.path;
  return module;
}
