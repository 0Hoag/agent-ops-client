import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { AppRouter } from './router';

/** Composes the client router and shared application layout. */
export function App() {
  return <BrowserRouter><AppLayout><AppRouter /></AppLayout></BrowserRouter>;
}
