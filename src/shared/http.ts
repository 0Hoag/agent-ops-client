import axios from 'axios';
import { getApiBaseUrl } from './env';

/** Shared HTTP client used by module service clients. */
export const http = axios.create({ baseURL: getApiBaseUrl() });

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('agent-ops-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
