import { createElement } from 'react';
import { HealthPage } from './HealthPage';
import { healthPaths } from './paths';

/** The routes and navigation entry exposed by the health module. */
export function createHealthModule() {
  return {
    path: healthPaths.health,
    nav: { label: 'Health', path: healthPaths.health },
    element: createElement(HealthPage),
  };
}
