import {
  Board,
  Carrier,
  CarriersStatus,
  KeyboardLayout,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import type { BoardService } from './board-service.type';

const mockBoards: Board[] = [
  {
    id: '1',
    name: 'Pippo',
    fqbn: 'arduino:zephyr:unoq',
    type: 'Arduino Uno Q',
    connectionType: 'USB',
    protocol: 'serial',
    serial: 'serial-1',
    address: '',
  },
  {
    id: '2',
    name: 'Pluto',
    fqbn: 'arduino:zephyr:unoq',
    type: 'Arduino Uno Q',
    connectionType: 'USB',
    protocol: 'serial',
    serial: 'serial-2',
    address: '',
  },
  {
    id: '3',
    name: 'Paperino',
    fqbn: 'arduino:zephyr:unoq',
    type: 'Arduino Uno Q',
    connectionType: 'USB',
    protocol: 'serial',
    serial: 'serial-3',
    address: '',
  },
];

const mockKeyboardLayouts: KeyboardLayout[] = [];

let selectedBoardId: string | null = null;
let boardName = '';
let keyboardLayoutId = 'default';
let isUserPasswordSetState = false;
const osImageVersion = '1.0.0';
const boardNeedsImageUpdateState = false;
let isNetworkModeEnabled = false;
const kernelVersion = '';
const linuxDistribution = '';

export const MockBoardService: BoardService = {
  async isBoard(): Promise<boolean> {
    return selectedBoardId !== null;
  },

  async getBoards(): Promise<Board[]> {
    return [...mockBoards];
  },

  async selectBoard(boardSerial: string, _password?: string): Promise<void> {
    const found = mockBoards.find((b) => b.serial === boardSerial);
    if (!found) {
      throw new Error(`Board "${boardSerial}" not found (mock)`);
    }
    selectedBoardId = boardSerial;
    boardName = found.name;
  },

  async getBoardName(): Promise<string> {
    return boardName;
  },

  async setBoardName(newName: string): Promise<void> {
    boardName = newName;

    if (!selectedBoardId) {
      return;
    }

    const idx = mockBoards.findIndex((b) => b.serial === selectedBoardId);
    if (idx !== -1) {
      mockBoards[idx] = { ...mockBoards[idx], name: newName };
    }
  },

  async getKeyboardLayout(): Promise<string> {
    return keyboardLayoutId;
  },

  async listKeyboardLayouts(): Promise<KeyboardLayout[]> {
    return [...mockKeyboardLayouts];
  },

  async setKeyboardLayout(layoutId: string): Promise<void> {
    keyboardLayoutId = layoutId;
  },

  async isUserPasswordSet(): Promise<boolean> {
    return isUserPasswordSetState;
  },

  async setUserPassword(_password: string): Promise<void> {
    isUserPasswordSetState = true;
  },

  async getOSImageVersion(): Promise<string> {
    return osImageVersion;
  },

  async boardNeedsImageUpdate(): Promise<boolean> {
    return boardNeedsImageUpdateState;
  },

  async openBoardTerminal(): Promise<void> {
    return Promise.resolve();
  },

  async isNetworkModeEnabled(): Promise<boolean> {
    return isNetworkModeEnabled;
  },

  async setNetworkMode(enabled: boolean): Promise<boolean> {
    isNetworkModeEnabled = enabled;
    return enabled;
  },

  async getKernelVersion(): Promise<string> {
    return kernelVersion;
  },

  async getLinuxDistribution(): Promise<string> {
    return linuxDistribution;
  },

  async getCarriers(): Promise<Carrier[]> {
    return [];
  },

  async getCarriersStatus(): Promise<CarriersStatus> {
    return {
      carriers: [
        {
          carrierName: '',
          current: [],
          currentEnabled: false,
          next: [],
          nextEnabled: false,
        },
      ],
    };
  },

  async enableCarriers(
    _status: CarriersStatus,
    _password: string,
  ): Promise<void> {
    return Promise.resolve();
  },

  async disableCarriers(
    _carriers: Carrier[],
    _password: string,
  ): Promise<void> {
    return Promise.resolve();
  },

  async rebootBoard(_password: string): Promise<void> {
    return Promise.resolve();
  },
};

export const mockGetBoards = (): Board[] => {
  return [...mockBoards];
};

export const mockSelectRandomBoard = (): Board | undefined => {
  const boards = mockGetBoards();
  if (!boards.length) {
    throw new Error('No boards available');
  }

  const randomIndex = Math.floor(Math.random() * boards.length);
  return boards[randomIndex];
};
