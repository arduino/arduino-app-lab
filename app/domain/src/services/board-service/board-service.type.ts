import {
  Board,
  HwList,
  HwStatus,
  KeyboardLayout,
  TerminalLaunchResult,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface BoardService {
  isBoard(): Promise<boolean>;
  getBoards(): Promise<Board[]>;
  selectBoard(boardId: string, password?: string): Promise<void>;
  getBoardName(): Promise<string>;
  setBoardName(boardName: string): Promise<void>;
  getKeyboardLayout(): Promise<string>;
  listKeyboardLayouts(): Promise<KeyboardLayout[]>;
  setKeyboardLayout(layoutId: string): Promise<void>;
  isUserPasswordSet(): Promise<boolean>;
  setUserPassword(password: string): Promise<void>;
  getOSImageVersion(): Promise<string>;
  boardNeedsImageUpdate(): Promise<boolean>;
  openBoardTerminal(): Promise<TerminalLaunchResult>;
  isNetworkModeEnabled(): Promise<boolean>;
  setNetworkMode(enabled: boolean, password: string): Promise<boolean>;
  getKernelVersion(): Promise<string>;
  getLinuxDistribution(): Promise<string>;
  isHwSupported(): Promise<boolean>;
  getHwList(): Promise<HwList>;
  getHwStatus(): Promise<HwStatus>;
  setHwStatus(status: HwStatus, password: string): Promise<void>;
  rebootBoard(password: string): Promise<void>;
}
