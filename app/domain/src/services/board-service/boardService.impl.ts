import { BoardService } from './board-service.type';

export let isBoard: BoardService['isBoard'] = async function () {
  throw new Error('disableSyncApp service not implemented');
};

export let selectBoard: BoardService['selectBoard'] = function () {
  throw new Error('selectBoard service not implemented');
};

export let getBoards: BoardService['getBoards'] = async function () {
  throw new Error('getBoards service not implemented');
};

export let getBoardName: BoardService['getBoardName'] = async function () {
  throw new Error('getBoardName service not implemented');
};

export let setBoardName: BoardService['setBoardName'] = async function () {
  throw new Error('setupBoardName service not implemented');
};

export let getKeyboardLayout: BoardService['getKeyboardLayout'] =
  async function () {
    throw new Error('getKeyboardLayout service not implemented');
  };

export let listKeyboardLayouts: BoardService['listKeyboardLayouts'] =
  async function () {
    throw new Error('listKeyboardLayouts service not implemented');
  };

export let setKeyboardLayout: BoardService['setKeyboardLayout'] =
  async function () {
    throw new Error('setKeyboardLayout service not implemented');
  };

export let isUserPasswordSet: BoardService['isUserPasswordSet'] =
  async function () {
    throw new Error('isUserPasswordSet service not implemented');
  };

export let setUserPassword: BoardService['setUserPassword'] =
  async function () {
    throw new Error('setUserPassword service not implemented');
  };

export let boardNeedsImageUpdate: BoardService['boardNeedsImageUpdate'] =
  async function () {
    throw new Error('boardNeedsImageUpdate service not implemented');
  };

export let openBoardTerminal: BoardService['openBoardTerminal'] =
  async function () {
    throw new Error('openBoardTerminal service not implemented');
  };

export const setBoardService = (service: BoardService): void => {
  isBoard = service.isBoard;
  getBoards = service.getBoards;
  selectBoard = service.selectBoard;
  getBoardName = service.getBoardName;
  setBoardName = service.setBoardName;
  getKeyboardLayout = service.getKeyboardLayout;
  listKeyboardLayouts = service.listKeyboardLayouts;
  setKeyboardLayout = service.setKeyboardLayout;
  isUserPasswordSet = service.isUserPasswordSet;
  setUserPassword = service.setUserPassword;
  boardNeedsImageUpdate = service.boardNeedsImageUpdate;
  openBoardTerminal = service.openBoardTerminal;
};
