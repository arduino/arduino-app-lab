import { BoardService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import {
  GetBoardList,
  GetBoardName,
  GetKeyboardLayout,
  IsBoard,
  IsUserPasswordSet,
  ListKeyboardLayouts,
  NeedsImageUpdate,
  OpenBoardTerminal,
  SelectBoard,
  SetBoardName,
  SetKeyboardLayout,
  SetUserPassword,
} from '../../wailsjs/go/app/App';
import { mapGetBoards } from './boardService.mapper';

export const isBoard: BoardService['isBoard'] = async function () {
  return IsBoard();
};

export const getBoards: BoardService['getBoards'] = async function () {
  try {
    const result = await GetBoardList();
    return mapGetBoards(result);
  } catch (e) {
    console.error('Error fetching boards:', e);
    return [];
  }
};

export const selectBoard: BoardService['selectBoard'] = async function (
  boardId: string,
  password?: string,
) {
  return SelectBoard(boardId, password || '');
};

export const getBoardName: BoardService['getBoardName'] = async function () {
  try {
    const boardName = await GetBoardName();
    return boardName;
  } catch (e) {
    console.error('Error getting board name:', e);
  }
  return '';
};

export const setBoardName: BoardService['setBoardName'] = async function (
  boardName: string,
) {
  try {
    return SetBoardName(boardName);
  } catch {
    console.error('Error setting board name:', boardName);
  }
  return;
};

export const getKeyboardLayout: BoardService['getKeyboardLayout'] =
  async function () {
    try {
      const layout = await GetKeyboardLayout();
      return layout;
    } catch (e) {
      console.error('Error getting keyboard layout:', e);
    }
    return '';
  };

export const listKeyboardLayouts: BoardService['listKeyboardLayouts'] =
  async function () {
    try {
      const layouts = await ListKeyboardLayouts();
      return layouts;
    } catch (e) {
      console.error('Error listing keyboard layouts:', e);
    }
    return [];
  };

export const setKeyboardLayout: BoardService['setKeyboardLayout'] =
  async function (layoutId: string) {
    try {
      return SetKeyboardLayout(layoutId);
    } catch {
      console.error('Error setting keyboard layout:', layoutId);
    }
    return;
  };

export const isUserPasswordSet: BoardService['isUserPasswordSet'] =
  async function () {
    try {
      return IsUserPasswordSet();
    } catch {
      console.error('Error getting user password set status');
    }
    return false;
  };

export const setUserPassword: BoardService['setUserPassword'] = async function (
  password: string,
) {
  try {
    return SetUserPassword(password);
  } catch {
    console.error('Error setting user password:', password);
  }
  return;
};

export const boardNeedsImageUpdate: BoardService['boardNeedsImageUpdate'] =
  async function () {
    return NeedsImageUpdate();
  };

export const openBoardTerminal: BoardService['openBoardTerminal'] =
  async function () {
    try {
      return await OpenBoardTerminal();
    } catch (e) {
      throw new Error(`${e}`);
    }
  };
