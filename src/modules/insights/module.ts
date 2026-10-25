import { createElement } from 'react';
import { InsightsPage } from './InsightsPage';
import { insightsPaths } from './paths';

export function createInsightsModule() {
  return { path: insightsPaths.insights, nav: { label: 'Insights', path: insightsPaths.insights }, element: createElement(InsightsPage) };
}
