import { BoardService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  HwError,
  HwErrorCode,
  HwList as HwListType,
  HwStatus,
  HwStatusDevice,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import {
  CarrierDisable,
  CarrierEnable,
  CarrierList,
  CarrierShow,
  DisableNetworkMode,
  EnableNetworkMode,
  GetBoardList,
  GetBoardName,
  GetKernelVersion,
  GetKeyboardLayout,
  GetLinuxDistribution,
  GetNetworkModeStatus,
  GetOSImageVersion,
  HwAvailable,
  HwDisable,
  HwEnable,
  HwList,
  HwShow,
  HwSupported,
  IsBoard,
  IsUserPasswordSet,
  ListKeyboardLayouts,
  NeedsImageUpdate,
  OpenBoardTerminal,
  RebootBoard,
  SelectBoard,
  SetBoardName,
  SetKeyboardLayout,
  SetUserPassword,
} from '../../wailsjs/go/app/App';
import {
  mapCarriers,
  mapCarriersStatus,
  mapGetBoards,
  mapHwList,
  mapHwShow,
} from './boardService.mapper';
import { filterBoards } from './boardService.utils';

export const isBoard: BoardService['isBoard'] = async function () {
  return IsBoard();
};

export const getBoards: BoardService['getBoards'] = async function () {
  try {
    const result = await GetBoardList();

    const mapped = mapGetBoards(result);

    const filtered = await filterBoards(mapped);

    const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));

    return sorted;
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
    await SetBoardName(boardName);
  } catch (e) {
    console.error('Error setting board name:', boardName, e);
    throw e;
  }
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
      await SetKeyboardLayout(layoutId);
    } catch (e) {
      console.error('Error setting keyboard layout:', layoutId, e);
      throw e;
    }
  };

export const isUserPasswordSet: BoardService['isUserPasswordSet'] =
  async function () {
    try {
      return await IsUserPasswordSet();
    } catch (e) {
      console.error('Error getting user password set status:', e);
    }
    return false;
  };

export const setUserPassword: BoardService['setUserPassword'] = async function (
  password: string,
) {
  try {
    await SetUserPassword(password);
  } catch (e) {
    console.error('Error setting user password:', e);
    throw e;
  }
};

export const getOSImageVersion: BoardService['getOSImageVersion'] =
  async function () {
    return GetOSImageVersion();
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

export const isNetworkModeEnabled: BoardService['isNetworkModeEnabled'] =
  async function () {
    try {
      return await GetNetworkModeStatus();
    } catch (e) {
      console.error('Error getting network mode status:', e);
    }
    return false;
  };

export const setNetworkMode: BoardService['setNetworkMode'] = async function (
  enabled: boolean,
  password: string,
) {
  try {
    await (enabled
      ? EnableNetworkMode(password)
      : DisableNetworkMode(password));

    // Verify the state actually changed to confirm success
    const newState = await GetNetworkModeStatus();

    return newState === enabled;
  } catch (error) {
    return false;
  }
};

export const getKernelVersion: BoardService['getKernelVersion'] =
  async function () {
    try {
      return await GetKernelVersion();
    } catch (e) {
      console.error('Error getting kernel version:', e);
    }
    return '';
  };

export const getLinuxDistribution: BoardService['getLinuxDistribution'] =
  async function () {
    try {
      return await GetLinuxDistribution();
    } catch (e) {
      console.error('Error getting Linux distribution:', e);
    }
    return '';
  };

export const isHwSupported: BoardService['isHwSupported'] = async function () {
  try {
    const result = await HwSupported();
    return result;
  } catch (e) {
    console.error('Error checking if hardware is supported:', e);
  }
  return false;
};

export const getHwList: BoardService['getHwList'] = async function () {
  const fetch = async (): Promise<HwListType> => {
    if (await HwAvailable()) {
      const result = await HwList();
      return mapHwList(result);
    }

    const result = await CarrierList();
    return mapCarriers(result);
  };

  try {
    const result = await fetch();
    return result;
  } catch (e) {
    console.error('Error getting hardware list:', e);
    throw new Error(`${e}`);
  }
};

export const getHwStatus: BoardService['getHwStatus'] = async function () {
  const fetch = async (): Promise<HwStatus> => {
    if (await HwAvailable()) {
      const result = await HwShow();
      return mapHwShow(result);
    }

    const result = await CarrierShow();
    return mapCarriersStatus(result);
  };

  try {
    const result = await fetch();
    return result;
  } catch (e) {
    console.error('Error getting hardware status:', e);
    throw new Error(`${e}`);
  }
};

// Go sends a hardware error as a JSON string: {"code": "...", "message": "..."}.
const toHwError = (e: unknown): HwError | undefined => {
  try {
    const { code, message } = JSON.parse(
      e instanceof Error ? e.message : String(e),
    );
    if (
      Object.values(HwErrorCode).includes(code) &&
      typeof message === 'string'
    ) {
      return new HwError(code, message);
    }
  } catch {
    // Not JSON: the error is not a hardware error.
  }
  return undefined;
};

export const setHwStatus: BoardService['setHwStatus'] = async function (
  status: HwStatus,
  password: string,
) {
  try {
    const available = await HwAvailable();

    const disable = (name: string): Promise<void> =>
      available ? HwDisable(password, name) : CarrierDisable(password, name);

    const enable = (name: string, devices: HwStatusDevice[]): Promise<void> => {
      const config = devices.map((it) => ({
        Device: it.device,
        Option: it.option,
      }));

      return available
        ? HwEnable(password, name, config)
        : CarrierEnable(password, name, config);
    };

    const disabled = status.mounts.filter(
      (mount) =>
        mount.currentEnabled &&
        (mount.kind === 'hat'
          ? !status.mounts.some((m) => m.kind === 'hat' && m.nextEnabled)
          : mount.nextDevices.every((device) => device.option === 'none')),
    );

    for (const mount of disabled) {
      await disable(mount.name);
    }

    const enabled = status.mounts.filter(
      (mount) =>
        (mount.nextEnabled && !mount.currentEnabled) ||
        (mount.kind === 'carrier' &&
          mount.nextDevices.some((device) => device.option !== 'none') &&
          mount.nextDevices.some(
            (device) =>
              mount.currentDevices.find(
                (current) => current.device === device.device,
              )?.option !== device.option,
          )),
    );

    for (const mount of enabled) {
      await enable(mount.name, mount.kind === 'hat' ? [] : mount.nextDevices);
    }
  } catch (e) {
    console.error('Error setting hardware status:', e);
    throw toHwError(e) ?? new Error(`${e}`);
  }
};

export const rebootBoard: BoardService['rebootBoard'] = async function (
  password: string,
) {
  try {
    await RebootBoard(password);
  } catch (e) {
    throw new Error(`${e}`);
  }
};
