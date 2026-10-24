import { createElement } from 'react';
import { BoardPage } from './BoardPage';
import { boardPaths } from './paths';

/** The routes and navigation entry exposed by the board module. */
export function createBoardModule() {
  return { path: boardPaths.board, nav: { label: 'Board', path: boardPaths.board }, element: createElement(BoardPage) };
}
