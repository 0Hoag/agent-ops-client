import { createElement } from 'react';
import { RepositoriesPage } from './page';
import { repositoriesPath } from './paths';

export function createRepositoriesModule() {
  return { path: repositoriesPath, element: createElement(RepositoriesPage) };
}
