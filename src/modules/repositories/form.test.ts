import { describe, expect, it } from 'vitest';
import { emptyRepositoryForm, parseStatusMappings, repositoryUpdate } from './form';

describe('repository settings form helpers', () => {
  it('creates fresh form objects and accepts only string-valued mapping objects', () => {
    expect(emptyRepositoryForm()).toEqual({ provider: 'github', full_name: '', status_mappings: {} });
    expect(emptyRepositoryForm()).not.toBe(emptyRepositoryForm());
    expect(parseStatusMappings('{"open":"todo"}')).toEqual({ open: 'todo' });
    expect(parseStatusMappings('[]')).toBeUndefined();
    expect(parseStatusMappings('{"open":1}')).toBeUndefined();
    expect(parseStatusMappings('{')).toBeUndefined();
  });
  it('limits PATCH fields and never includes provider or full name', () => {
    expect(repositoryUpdate('https://git.example', { open: 'todo' }, true)).toEqual({ gitlab_base_url: 'https://git.example', status_mappings: { open: 'todo' } });
    expect(repositoryUpdate('', {}, false)).toEqual({ status_mappings: {} });
  });
});
