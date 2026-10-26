import { createMembersModule } from '../modules/members/module';
import { paths } from './paths';

export function registerMembers() {
  const module = createMembersModule();
  paths.members = module.path;
  return module;
}
