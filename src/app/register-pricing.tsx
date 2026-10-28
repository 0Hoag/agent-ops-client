import { createPricingModule } from '../modules/pricing/module';
import { paths } from './paths';

export function registerPricing() {
  const module = createPricingModule();
  paths.pricing = module.path;
  return module;
}
