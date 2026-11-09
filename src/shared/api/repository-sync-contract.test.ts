import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

describe('repository sync contract', () => {
  it('publishes manual sync and preserves established repository contracts', () => {
    const spec = swagger as { paths: Record<string, Record<string, { security?: Array<Record<string, string[]>>; parameters?: Array<{ in: string; name?: string; required?: boolean }>; responses: Record<string, { schema?: { $ref?: string } }> }>>; definitions: Record<string, { properties?: Record<string, unknown> }> };
    const syncPath = '/api/v1/repositories/{repository_id}/sync';
    const sync = spec.paths[syncPath].post;
    expect(sync).toBeTruthy();
    expect(sync.parameters).toEqual(expect.arrayContaining([expect.objectContaining({ in: 'path', name: 'repository_id', required: true })]));
    expect(sync.responses['200'].schema?.$ref).toBe('#/definitions/repositorysettings.ViewResponse');
    expect(sync.security).toEqual([{ BearerAuth: [] }]);
    for (const status of ['401', '403', '404', '500']) {
      expect(sync.responses[status].schema?.$ref).toBe('#/definitions/response.ErrorResponse');
    }
    const repository = Object.values(spec.definitions).find(({ properties }) => properties && ['last_synced_at', 'last_sync_status', 'last_sync_error'].every((field) => field in properties));
    expect(repository?.properties).toEqual(expect.objectContaining({ last_synced_at: expect.anything(), last_sync_status: expect.anything(), last_sync_error: expect.anything() }));
    expect(spec.paths['/api/v1/overview'].get.responses['200']).toBeTruthy();
    expect(spec.definitions['repositorysettings.CreateRequest'].properties).not.toHaveProperty('price_per_minute');
    expect(spec.paths['/api/v1/repositories/{repository_id}'].delete.responses['409']).toBeTruthy();
    expect(spec.paths['/api/v1/repositories/test'].post.responses['200']).toBeTruthy();
  });
});
