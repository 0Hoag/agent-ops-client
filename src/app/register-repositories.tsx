import { createRepositoriesModule } from '../modules/repositories/module';
import { paths } from './paths';
export function registerRepositories() { const module = createRepositoriesModule(); paths.repositories = module.path; return module; }
