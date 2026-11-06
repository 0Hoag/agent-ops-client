import { createAlertsModule } from '../modules/alerts/module';
import { paths } from './paths';
export function registerAlerts() { const module = createAlertsModule(); paths.alerts = module.path; return module; }
