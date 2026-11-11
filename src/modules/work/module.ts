import { createElement } from 'react';
import { WorkPage } from './page';

export function createWorkModule() {
  return { path: '/work', nav: { label: 'Work', path: '/work' }, element: createElement(WorkPage) };
}
