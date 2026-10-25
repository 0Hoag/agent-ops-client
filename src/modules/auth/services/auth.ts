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
  } catch (error) {
    logout();
    throw error;
  }
  return token;
}

export async function validateSession() {
  if (!sessionStorage.getItem(tokenKey)) return false;
  try {
    await authClient.api.v1AuthSessionList();
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
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
