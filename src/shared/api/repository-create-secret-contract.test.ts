import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

const generated = readFileSync(new URL('./generated/Api.ts', import.meta.url), 'utf8');
const createdView = generated.match(/export interface RepositorysettingsCreatedView \{([^}]+)\}/)?.[1];
const createRequest = generated.match(/export interface RepositorysettingsCreateRequest \{([^}]+)\}/)?.[1];

describe('repository create secret contract', () => {
  it('never advertises a backfill token in the created response', () => {
    expect(swagger.definitions['repositorysettings.CreatedResponse'].properties.data.$ref)
      .toBe('#/definitions/repositorysettings.CreatedView');
    expect(swagger.definitions['repositorysettings.CreatedView'].properties).not.toHaveProperty('backfill_token');
    expect(createdView).toBeDefined();
    expect(createdView).not.toContain('backfill_token');
  });

  it('preserves exactly one webhook secret and the webhook URL in the created response', () => {
    const properties = swagger.definitions['repositorysettings.CreatedView'].properties;
    expect(properties.webhook_secret).toEqual({ type: 'string' });
    expect(properties.webhook_url).toEqual({ type: 'string' });
    expect(createdView?.match(/webhook_secret\?: string;/g)).toHaveLength(1);
    expect(createdView?.match(/webhook_url\?: string;/g)).toHaveLength(1);
  });

  it('keeps input token and webhook secret handling unchanged', () => {
    const properties = swagger.definitions['repositorysettings.CreateRequest'].properties;
    expect(properties.backfill_token).toEqual({ type: 'string' });
    expect(properties.webhook_secret).toEqual({ type: 'string' });
    expect(createRequest?.match(/backfill_token\?: string;/g)).toHaveLength(1);
    expect(createRequest?.match(/webhook_secret\?: string;/g)).toHaveLength(1);
  });
});
