import { SessionPage } from '../modules/sessions/SessionPage';

export function registerSessions() { return { path: '/usage/sessions', element: <SessionPage /> }; }
