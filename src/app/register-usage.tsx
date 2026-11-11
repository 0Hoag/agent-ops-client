import { UsagePage } from '../modules/usage/UsagePage';

export function registerUsage() { return { path: '/usage', element: <UsagePage /> }; }
