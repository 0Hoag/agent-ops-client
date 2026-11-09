import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

describe('repository connection-test contract', () => {
  it('publishes test and preserves established repository contracts', () => {
    const spec = swagger as { paths: Record<string, Record<string, { parameters?: Array<{ in: string; schema?: { $ref?: string } }>; responses: Record<string, { schema?: { $ref?: string } }> }>>; definitions: Record<string, { properties?: Record<string, unknown> }> };
    const test = spec.paths['/api/v1/repositories/test'].post;
    expect(test.parameters?.find(({ in: location }) => location === 'body')?.schema?.$ref).toBe('#/definitions/repositorysettings.TestRequest');
    expect(test.responses['200']?.schema?.$ref).toBe('#/definitions/repositorysettings.TestResponse');
    for (const status of ['400', '401', '403', '422', '502']) expect(test.responses[status]?.schema?.$ref).toBe('#/definitions/response.ErrorResponse');
    expect(spec.definitions['repositorysettings.TestRequest'].properties).toEqual(expect.objectContaining({ provider: expect.anything(), base_url: expect.anything(), full_name: expect.anything(), token: expect.anything() }));
    expect(spec.paths['/api/v1/overview'].get.responses['200']).toBeTruthy();
    expect(spec.definitions['repositorysettings.CreateRequest'].properties).not.toHaveProperty('price_per_minute');
    expect(spec.paths['/api/v1/repositories/{repository_id}'].delete.responses['409']).toBeTruthy();
  });
});
