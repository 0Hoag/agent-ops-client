import axios from 'axios';
import { getApiBaseUrl } from './env';

/** Shared HTTP client used by module service clients. */
export const http = axios.create({ baseURL: getApiBaseUrl(), transitional: { silentJSONParsing: false } });

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('agent-ops-token');
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.code === 'ERR_BAD_RESPONSE' && error.cause instanceof SyntaxError) {
    return Promise.reject(new Error('The server returned an unreadable response. Please try again.'));
  }
  if (axios.isAxiosError(error) && error.response?.status === 401 &&
      error.config?.headers.Authorization === `Bearer ${sessionStorage.getItem('agent-ops-token')}` &&
      sessionStorage.getItem('agent-ops-token')) {
    sessionStorage.removeItem('agent-ops-token');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  return Promise.reject(error);
});
