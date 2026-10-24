/** Returns the API base URL injected by the build configuration. */
export function getApiBaseUrl(): string {
  return process.env.APP_API_URL || '/';
}
