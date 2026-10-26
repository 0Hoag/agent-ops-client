import { authClient } from './client';
import axios from 'axios';

const tokenKey = 'agent-ops-token';

export interface Organization { id: string; name: string; }

export async function login(email: string, password: string) {
  const response = await authClient.api.v1AuthLoginCreate({ email, password });
  const token = response.data.token;
  if (!token) throw new Error('Login response did not contain a token');
  sessionStorage.setItem(tokenKey, token);
  try {
    const session = await authClient.api.v1AuthSessionList();
    if (sessionStorage.getItem(tokenKey) !== token) throw new Error('Session changed during validation');
    return { token, organizationId: session.data.organization_id };
  } catch (error) {
    if (sessionStorage.getItem(tokenKey) === token) logout();
    throw error;
  }
}

export async function listOrganizations() {
  if (!sessionStorage.getItem(tokenKey)) return [];
  const response = (await authClient.api.v1OrganizationsList()).data.data;
  return Array.isArray(response) ? response as Organization[] : [];
}

export async function selectOrganization(organizationId: string) {
  const previousToken = sessionStorage.getItem(tokenKey);
  const response = await authClient.api.v1AuthSelectOrganizationCreate({ organization_id: organizationId });
  const selectedToken = response.data.token;
  if (!selectedToken) throw new Error('Organization selection did not return a token');
  if (!previousToken) throw new Error('No active session');
  if (sessionStorage.getItem(tokenKey) !== previousToken) throw new Error('Session changed during organization selection');
  // Validate the issued tenant token, without making it the active credential yet.
  const session = await authClient.api.v1AuthSessionList({ headers: { Authorization: `Bearer ${selectedToken}` } });
  if (session.data.organization_id !== organizationId) throw new Error('Organization selection was not validated');
  if (sessionStorage.getItem(tokenKey) !== previousToken) throw new Error('Session changed during organization selection');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('organization:will-change'));
  sessionStorage.setItem(tokenKey, selectedToken);
  return selectedToken;
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
