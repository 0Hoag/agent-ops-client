import { createBoardModule } from '../modules/board/module';
import { paths } from './paths';

/** Registers the board module's canonical route path. */
export function registerBoard() {
  const module = createBoardModule();
  paths.board = module.path;
  return module;
}
