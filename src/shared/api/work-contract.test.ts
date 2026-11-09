import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

describe('generated work contract', () => {
  it('publishes list and detail operations with their actual parameters and responses', () => {
    const list = swagger.paths['/api/v1/work'].get;
    expect(list.parameters.map(({ name, in: location, required }) => [name, location, required])).toEqual([
      ['repository_id', 'query', true], ['state', 'query', undefined], ['q', 'query', undefined], ['page', 'query', undefined],
    ]);
    expect(list.responses['200'].schema.$ref).toBe('#/definitions/work.ListResponse');
    const detail = swagger.paths['/api/v1/work/{kind}/{number}'].get;
    expect(detail.parameters.map(({ name, in: location, required }) => [name, location, required])).toEqual([
      ['repository_id', 'query', true], ['kind', 'path', true], ['number', 'path', true],
    ]);
    expect(detail.responses['200'].schema.$ref).toBe('#/definitions/work.Detail');
    expect(swagger.definitions['work.Item'].properties.cost_usd).toEqual({ type: 'number' });
    expect(swagger.definitions['work.Run'].properties.cost_usd).toEqual({ type: 'number' });
  });

  it('preserves earlier published contracts', () => {
    expect(swagger.paths['/api/v1/agent-runs']).toBeDefined();
    expect(swagger.paths['/api/v1/repositories/{repository_id}'].delete).toBeDefined();
    expect(swagger.paths['/api/v1/repositories/test']).toBeDefined();
    expect(swagger.paths['/api/v1/overview']).toBeDefined();
    expect(swagger.paths['/api/v1/agent-run-prices/missing']).toBeDefined();
  });
});
