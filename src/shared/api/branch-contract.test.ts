import { describe, expect, it } from 'vitest';
import swagger from './swagger.json';
import type { AgentrunAgentRun, AgentrunCreateInput } from './generated/Api';

describe('agent run branch contract', () => {
  it('publishes branch on ingestion and responses while preserving existing contracts', () => {
    expect(swagger.definitions['agentrun.CreateInput'].properties).toHaveProperty('branch');
    expect(swagger.definitions['agentrun.AgentRun'].properties).toHaveProperty('branch');
    const input: AgentrunCreateInput = { branch: 'main', ended_at: '', model: '', repository_id: '', started_at: '', wave: '', worker: '' };
    const response: AgentrunAgentRun = { branch: 'main' };
    expect(input.branch).toBe('main');
    expect(response.branch).toBe('main');
    expect(swagger.paths['/api/v1/agent-runs']).toBeDefined();
    expect(swagger.paths['/api/v1/overview']).toBeDefined();
    expect(swagger.paths['/api/v1/repositories/{repository_id}'].delete.responses).toHaveProperty('409');
    expect(swagger.paths['/api/v1/repositories/test'].post.responses).toHaveProperty('200');
    expect(swagger.paths['/api/v1/agent-run-prices/missing']).toBeDefined();
  });
});
