import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

describe('repository delete contract', () => {
  it('publishes conflict while retaining overview and missing-price contracts', () => {
    expect(swagger.paths['/api/v1/repositories/{repository_id}'].delete.responses)
      .toHaveProperty('409');
    expect(swagger.paths['/api/v1/overview']).toBeDefined();
    expect(swagger.paths['/api/v1/agent-run-prices/missing']).toBeDefined();
  });
});
