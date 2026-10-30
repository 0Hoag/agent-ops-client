import { createElement } from 'react';
import { WavesPage } from './page';
import { wavesPath } from './paths';

export function createWavesModule() {
  return { path: wavesPath, element: createElement(WavesPage) };
}
