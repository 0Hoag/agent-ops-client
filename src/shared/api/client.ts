import { Api, HttpClient } from './generated/Api';
import { http } from '../http';

/** Generated API operations using the application's configured Axios instance. */
export const api = new Api(new HttpClient({ baseUrl: '', instance: http }));
