import axios from 'axios';
import { getApiBaseUrl } from './env';

/** Shared HTTP client used by module service clients. */
export const http = axios.create({ baseURL: getApiBaseUrl() });
