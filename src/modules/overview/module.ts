import { createElement } from 'react';
import { OverviewPage } from './page';

export function createOverviewModule() {
  return { path: '/', nav: { label: 'Overview', path: '/' }, element: createElement(OverviewPage) };
}
