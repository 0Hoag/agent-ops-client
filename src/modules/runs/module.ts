import { createElement } from 'react';
import { RunsPage } from './RunsPage';
import { runsPaths } from './paths';

export function createRunsModule() {
  return { path: runsPaths.runs, nav: { label: 'Runs', path: runsPaths.runs }, element: createElement(RunsPage) };
}
