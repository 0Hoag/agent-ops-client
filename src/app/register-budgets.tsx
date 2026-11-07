import { createBudgetsModule } from '../modules/budgets/module';
import { paths } from './paths';
export function registerBudgets() { const module = createBudgetsModule(); paths.budgets = module.path; return module; }
