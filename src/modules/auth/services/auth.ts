import { authClient } from './client';
import axios from 'axios';

const tokenKey = 'agent-ops-token';

export async function login(email: string, password: string) {
  const response = await authClient.api.v1AuthLoginCreate({ email, password });
  const token = response.data.token;
  if (!token) throw new Error('Login response did not contain a token');
  sessionStorage.setItem(tokenKey, token);
  try {
    await authClient.api.v1AuthSessionList();
    if (sessionStorage.getItem(tokenKey) !== token) throw new Error('Session changed during validation');
  } catch (error) {
    if (sessionStorage.getItem(tokenKey) === token) logout();
    throw error;
  }
  return token;
}

export async function validateSession() {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return false;
  try {
    await authClient.api.v1AuthSessionList();
    if (sessionStorage.getItem(tokenKey) !== token) throw new Error('Session changed during validation');
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const currentToken = sessionStorage.getItem(tokenKey);
      if (currentToken && currentToken !== token) throw error;
      logout();
      return false;
    }
    throw error;
  }
}

export function logout() {
  sessionStorage.removeItem(tokenKey);
}

export function hasToken() {
  return Boolean(sessionStorage.getItem(tokenKey));
}
