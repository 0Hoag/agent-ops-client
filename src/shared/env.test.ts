import { describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './env';

describe('getApiBaseUrl', () => {
  it('uses the build-injected API URL', () => {
    expect(getApiBaseUrl()).toBe(process.env.APP_API_URL || '/');
  });
});
