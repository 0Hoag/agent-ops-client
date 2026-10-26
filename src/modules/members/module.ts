import { createElement } from 'react';
import { MembersPage } from './MembersPage';
import { membersPaths } from './paths';

export function createMembersModule() {
  return { path: membersPaths.members, nav: { label: 'Members', path: membersPaths.members }, element: createElement(MembersPage) };
}
