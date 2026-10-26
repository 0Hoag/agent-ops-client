import type { RepositorysettingsCreateRequest, RepositorysettingsUpdateRequest } from '../../shared/api/generated/Api';

/** A fresh form object prevents credentials from surviving organization changes. */
export function emptyRepositoryForm(): RepositorysettingsCreateRequest {
  return { provider: 'github', full_name: '', status_mappings: {} };
}

/** Validates user-supplied label mappings as a JSON object before mutation. */
export function parseStatusMappings(value: string): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    if (Object.values(parsed).some((entry) => typeof entry !== 'string')) return undefined;
    return parsed as Record<string, string>;
  } catch {
    return undefined;
  }
}

/** Builds an update strictly from supported generated fields. */
export function repositoryUpdate(gitlabBaseUrl: string, mappings: Record<string, string>, isGitLab: boolean): RepositorysettingsUpdateRequest {
  return { ...(isGitLab ? { gitlab_base_url: gitlabBaseUrl } : {}), status_mappings: mappings };
}
