import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';

describe('repository create contract', () => {
  it('documents a conflict response for duplicate repositories', () => {
    expect(swagger.paths['/api/v1/repositories'].post.responses).toHaveProperty('409');
  });
});
