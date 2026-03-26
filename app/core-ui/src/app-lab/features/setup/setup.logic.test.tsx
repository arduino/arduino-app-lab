import {
  Board,
  SetupItemId,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import TestProviderWrapper from '../../../../tests-setup';
import {
  BoardConfigurationContext,
  BoardConfigurationContextValue,
} from '../../providers/board-configuration/boardConfigurationContext';
import {
  LinuxCredentialsContext,
  LinuxCredentialsContextValue,
} from '../../providers/linux-credentials/linuxCredentialsContext';
import {
  NetworkContext,
  NetworkContextValue,
} from '../../providers/network/networkContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { UseSetup } from '../../providers/setup/setupContextProvider.logic';
import { SystemPropKey } from '../../store/systemProps';
import { createUseSetupLogic, SetupSteps } from './setup.logic';

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    setNetworkMode: vi.fn().mockResolvedValue(undefined),
  }),
);

let isBoardMock: boolean | undefined;

let boardsMock: Array<{
  id: string;
  name: string;
  type: string;
  connectionType: 'USB' | 'Network' | 'Local';
  protocol: string;
  serial: string;
  address: string;
}> = [];

const selectBoardMock = vi.fn().mockResolvedValue(undefined);
let showBoardConnPswPromptMock = false;
const onConnPswCancelMock = vi.fn();
const onConnPswSubmitMock = vi
  .fn<[password: string], Promise<void>>()
  .mockImplementation(() => Promise.resolve());
let isConnectingToBoardMock = false;
let connToBoardErrorMock: string | undefined;
let connToBoardCompletedMock = false;
const setSelectedBoardCheckingStatusMock = vi.fn();
const autoSelectBoardMock = vi.fn().mockResolvedValue(undefined);

let systemPropsMock: Record<string, string> | null = null;
let getPropsErrorMock: Error | null = null;

const createMockBoardsProps = (): {
  boards: Array<{
    id: string;
    name: string;
    type: string;
    connectionType: 'USB' | 'Network' | 'Local';
    protocol: string;
    serial: string;
    address: string;
  }>;
  selectedBoard?: Board;
  selectBoard: (board: Board) => Promise<void>;
  autoSelectBoard: (boardId: string) => Promise<void>;
  isAutoSelectingBoard: boolean;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isConnectingToBoard: boolean;
  connToBoardError: string | undefined;
  connToBoardCompleted: boolean;
  setSelectedBoardCheckingStatus: () => void;
} => ({
  boards: boardsMock,
  selectedBoard: undefined,
  selectBoard: selectBoardMock as (board: Board) => Promise<void>,
  autoSelectBoard: autoSelectBoardMock as (boardId: string) => Promise<void>,
  isAutoSelectingBoard: false,
  showBoardConnPswPrompt: showBoardConnPswPromptMock,
  onConnPswCancel: onConnPswCancelMock as () => void,
  onConnPswSubmit: onConnPswSubmitMock as (password: string) => Promise<void>,
  isConnectingToBoard: isConnectingToBoardMock,
  connToBoardError: connToBoardErrorMock,
  connToBoardCompleted: connToBoardCompletedMock,
  setSelectedBoardCheckingStatus:
    setSelectedBoardCheckingStatusMock as () => void,
});
let getPropsLoadingMock = false;
const upsertPropMock = vi.fn();
let upsertPropsLoadingMock = false;

let footerItemsMock = [
  {
    id: 'board',
    label: 'Mock Board',
    state: 'default',
  },
];
const onOpenTerminalMock = vi.fn<[], Promise<void>>().mockResolvedValue();
let terminalErrorMock: string | null = null;

vi.mock('../../hooks/useIsBoard', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useIsBoard')>(
    '../../hooks/useIsBoard',
  );
  return {
    ...actual,
    useIsBoard: vi.fn(() => ({ data: isBoardMock })),
  };
});

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');
  return {
    ...actual,
    useBoards: vi.fn(() => ({
      boards: boardsMock,
      selectBoard: selectBoardMock,
      showBoardConnPswPrompt: showBoardConnPswPromptMock,
      onConnPswCancel: onConnPswCancelMock,
      onConnPswSubmit: onConnPswSubmitMock,
      isConnectingToBoard: isConnectingToBoardMock,
      connToBoardError: connToBoardErrorMock,
      connToBoardCompleted: connToBoardCompletedMock,
      setSelectedBoardCheckingStatus: setSelectedBoardCheckingStatusMock,
    })),
  };
});

vi.mock('../../hooks/useSystemProps', async () => {
  const actual = await vi.importActual<
    typeof import('../../hooks/useSystemProps')
  >('../../hooks/useSystemProps');
  return {
    ...actual,
    useSystemProps: vi.fn(() => ({
      systemProps: systemPropsMock,
      getPropsError: getPropsErrorMock,
      getPropsLoading: getPropsLoadingMock,
      upsertProp: upsertPropMock,
      upsertPropsLoading: upsertPropsLoadingMock,
    })),
  };
});

vi.mock('../footer-bar/footerBar.logic', async () => {
  const actual = await vi.importActual<
    typeof import('../footer-bar/footerBar.logic')
  >('../footer-bar/footerBar.logic');
  return {
    ...actual,
    useFooterBarLogic: vi.fn(() => ({
      items: footerItemsMock,
      onOpenTerminal: onOpenTerminalMock,
      terminalError: terminalErrorMock,
    })),
  };
});

let boardConfigurationCtxValue: BoardConfigurationContextValue; //useBoardConfiguration()
let networkCtxValue: NetworkContextValue; //useNetwork()
let linuxCredentialsCtxValue: LinuxCredentialsContextValue; //useLinuxCredentials()
let setupCtxValue: ReturnType<UseSetup>; //useSetup()

const ProvidersWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <TestProviderWrapper>
      <SetupContext.Provider value={setupCtxValue}>
        <NetworkContext.Provider value={networkCtxValue}>
          <LinuxCredentialsContext.Provider value={linuxCredentialsCtxValue}>
            <BoardConfigurationContext.Provider
              value={boardConfigurationCtxValue}
            >
              {children}
            </BoardConfigurationContext.Provider>
          </LinuxCredentialsContext.Provider>
        </NetworkContext.Provider>
      </SetupContext.Provider>
    </TestProviderWrapper>
  );
};

beforeAll(() => {
  vi.useFakeTimers();
  process.env.APP_ENV = 'mock';
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  isBoardMock = undefined;
  boardsMock = [];
  showBoardConnPswPromptMock = false;
  isConnectingToBoardMock = false;
  connToBoardErrorMock = undefined;
  connToBoardCompletedMock = false;

  systemPropsMock = null;
  getPropsErrorMock = null;
  getPropsLoadingMock = false;
  upsertPropsLoadingMock = false;

  footerItemsMock = [
    {
      id: 'board',
      label: 'Mock Board',
      state: 'default',
    },
  ];
  terminalErrorMock = null;

  boardConfigurationCtxValue = {
    setBoardNameIsSuccess: false,
    setKeyboardLayoutIsSuccess: false,
    setBoardConfigurationIsSuccess: false,
    hasBoardConfigurationError: false,
    checkBoardName: vi.fn(() => true),
    proposeName: vi.fn(() => 'Proposed Name'),
    boardConfigurationChecked: true,
    boardConfigurationIsSet: false,
    keyboardLayout: '',
    keyboardLayouts: [],
    keyboardLayoutErrorMsg: '',
    setBoardConfiguration: vi.fn(),
    skipBoardConfiguration: vi.fn(),
    setBoardConfigurationIsLoading: false,
    setKeyboardLayoutIsError: false,
    boardName: '',
    setBoardNameIsError: false,
    boardNameErrorMsg: '',
    setBoardName: vi.fn(),
    setKeyboardLayout: vi.fn(),
  };

  networkCtxValue = {
    networkList: [],
    isScanning: false,
    setScanningIsEnabled: vi.fn(),
    scanNetworkList: vi.fn(),
    connectToWifiNetwork: vi.fn(),
    disconnectFromNetwork: vi.fn(),

    isNetworkStatusLoading: false,
    networkStatusChecked: false,
    isConnected: false,
    isStatusConnecting: false,
    isConnecting: false,
    connectRequestIsError: false,
    connectRequestIsSuccess: false,

    selectedNetwork: undefined,
    setSelectedNetwork: vi.fn(),

    manualNetworkSetup: false,
    setManualNetworkSetup: vi.fn(),
  };

  linuxCredentialsCtxValue = {
    userPasswordChecked: false,
    userPasswordIsSet: false,
    setUserPassword: vi.fn(),
    setUserPasswordIsLoading: false,
    setUserPasswordIsError: false,
    setUserPasswordIsSuccess: false,
    userPasswordErrorMsg: '',
    setUserPasswordConfirmationIsError: false,
    userPasswordConfirmationErrorMsg: '',
  };

  let currentStepMock: SetupSteps = 'waiting-selection' as const;
  let setupCompletedMock = false;

  setupCtxValue = {
    get setupCompleted() {
      return setupCompletedMock;
    },
    setSetupCompleted: vi.fn((completed) => {
      setupCompletedMock = completed;
    }),
    networkStepSkipped: false,
    setNetworkStepSkipped: vi.fn(),
    get currentStep() {
      return currentStepMock;
    },
    setCurrentStep: vi.fn((step) => {
      currentStepMock =
        typeof step === 'function' ? step(currentStepMock) : step;
    }),
    networkCredentialsDraft: undefined,
    setNetworkCredentialsDraft: vi.fn(),
    autoFlowLocked: false,
    setAutoFlowLocked: vi.fn(),
  };
});

describe('createUseSetupLogic - board selection vs setup steps', () => {
  it('shows board selection page when no board is detected', async () => {
    isBoardMock = undefined;
    systemPropsMock = null;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: false,
    };

    const { result } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.showBoardSelectionPage).toBe(true);
      expect(result.current.showPostSelectionSetup).toBe(false);
    });
  });

  it('when no board is preselected, select one from the list and then enter setup flow', async () => {
    isBoardMock = undefined;
    systemPropsMock = {} as Record<string, string>;
    getPropsLoadingMock = false;

    boardsMock = [
      {
        id: 'board-1',
        name: 'My Board 1',
        type: 'Arduino Uno Q',
        connectionType: 'USB',
        protocol: 'serial',
        serial: '',
        address: '',
      },
    ];

    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: false,
      isConnected: false,
    };

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.showBoardSelectionPage).toBe(true);
      expect(result.current.showPostSelectionSetup).toBe(false);
      expect(result.current.boards).toEqual(boardsMock);
    });
    const selectedBoard = boardsMock[0];
    result.current.selectBoard(selectedBoard);

    expect(selectBoardMock).toHaveBeenCalledTimes(1);
    expect(selectBoardMock).toHaveBeenCalledWith(selectedBoard);

    connToBoardCompletedMock = true;
    isBoardMock = true;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
    };

    systemPropsMock = {} as Record<string, string>;

    act(() => {
      rerender();
    });

    // wait connToBoardCompleted effect to run and trigger the step change
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // rerender to ensure the hook sees the updated context values
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.showBoardSelectionPage).toBe(false);
      expect(result.current.showPostSelectionSetup).toBe(true);
      expect(result.current.currentStep).toBe(SetupItemId.BoardConfiguration);
    });
  });
});

describe('createUseSetupLogic - 3 step flow', () => {
  it('passes BoardConfiguration -> NetworkSetup -> LinuxCredentials -> done based on SystemProps / network', async () => {
    isBoardMock = true;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
    };
    systemPropsMock = {} as Record<string, string>;

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.showPostSelectionSetup).toBe(true);
      expect(result.current.currentStep).toBe(SetupItemId.BoardConfiguration);
    });

    systemPropsMock = {
      ...systemPropsMock,
      [SystemPropKey.SetupBoardName]: 'done',
      [SystemPropKey.SetupKeyboard]: 'done',
    };

    act(() => {
      rerender();
    });
    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
    });

    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: true,
    };

    act(() => {
      rerender();
    });
    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.LinuxCredentials);
    });

    systemPropsMock = {
      ...systemPropsMock,
      [SystemPropKey.SetupCredentials]: 'done',
    };

    act(() => {
      rerender();
    });
    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(setupCtxValue.setSetupCompleted).toHaveBeenCalledWith(true);
      expect(result.current.showPostSelectionSetup).toBe(false);
      expect(result.current.showBoardSelectionPage).toBe(false);
    });
  });

  it('showConfirmButton is false in NetworkSetup if no network is selected and it is not manual', async () => {
    isBoardMock = true;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
      manualNetworkSetup: false,
      selectedNetwork: undefined,
    };
    systemPropsMock = {
      [SystemPropKey.SetupBoardName]: 'done',
      [SystemPropKey.SetupKeyboard]: 'done',
    } as Record<string, string>;

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
      expect(result.current.showConfirmButton).toBe(false);
    });

    networkCtxValue = {
      ...networkCtxValue,
      manualNetworkSetup: true,
    };
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.showConfirmButton).toBe(true);
    });
  });
});

describe('createUseSetupLogic - SystemProps persistence when steps succeed', () => {
  it('calls upsertProp for BoardName/Keyboard/Credentials/Network when success flags are true', async () => {
    isBoardMock = true;
    systemPropsMock = {} as Record<string, string>;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: true,
      connectRequestIsSuccess: true,
    };
    boardConfigurationCtxValue = {
      ...boardConfigurationCtxValue,
      setBoardNameIsSuccess: true,
      setKeyboardLayoutIsSuccess: true,
      setBoardConfigurationIsSuccess: true,
    };
    linuxCredentialsCtxValue = {
      ...linuxCredentialsCtxValue,
      setUserPasswordIsSuccess: true,
    };

    renderHook(() => createUseSetupLogic(createMockBoardsProps())(), {
      wrapper: ProvidersWrapper,
    });

    await waitFor(() => {
      expect(upsertPropMock).toHaveBeenCalledWith({
        key: SystemPropKey.SetupBoardName,
        value: 'done',
      });
      expect(upsertPropMock).toHaveBeenCalledWith({
        key: SystemPropKey.SetupKeyboard,
        value: 'done',
      });
      expect(upsertPropMock).toHaveBeenCalledWith({
        key: SystemPropKey.SetupCredentials,
        value: 'done',
      });
      expect(upsertPropMock).toHaveBeenCalledWith({
        key: SystemPropKey.SetupNetwork,
        value: 'done',
      });
    });
  });
});

describe('createUseSetupLogic - error handling systemProps', () => {
  it('when getPropsError is present and board is offline, goes directly to NetworkSetup step', async () => {
    isBoardMock = true;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
    };

    // SystemProps fetch error
    getPropsErrorMock = new Error('System props failed');
    getPropsLoadingMock = false;
    systemPropsMock = null;

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      // should skip to NetworkSetup
      expect(result.current.showPostSelectionSetup).toBe(true);
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
    });
  });
});

describe('createUseSetupLogic - error handling board configuration', () => {
  it('makes the BoardConfiguration step skippable when hasBoardConfigurationError is true', async () => {
    isBoardMock = true;
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
    };

    systemPropsMock = {} as Record<string, string>;

    boardConfigurationCtxValue = {
      ...boardConfigurationCtxValue,
      hasBoardConfigurationError: true,
    };

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.showPostSelectionSetup).toBe(true);
      expect(result.current.currentStep).toBe(SetupItemId.BoardConfiguration);

      expect(result.current.stepIsSkippable).toBe(true);
    });
  });
});

describe('createUseSetupLogic - error handling board connection', () => {
  it('exposes connToBoardError and is not in connecting state when connection fails', async () => {
    isBoardMock = undefined;

    boardsMock = [
      {
        id: 'board-err',
        name: 'Error Board',
        type: 'Arduino Uno Q',
        connectionType: 'USB',
        protocol: 'serial',
        serial: '',
        address: '',
      },
    ];
    connToBoardErrorMock = 'Unable to connect';
    isConnectingToBoardMock = false;
    connToBoardCompletedMock = false;

    const { result } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.showBoardSelectionPage).toBe(true);
      expect(result.current.connToBoardError).toBe('Unable to connect');
      expect(result.current.isBoardConnectingOrChecking).toBe(false);
    });
  });
});

describe('createUseSetupLogic - wifi list & custom wifi', () => {
  it('when the wifi list is populated, the confirm remains disabled until a network is selected', async () => {
    isBoardMock = true;
    systemPropsMock = {
      [SystemPropKey.SetupBoardName]: 'done',
      [SystemPropKey.SetupKeyboard]: 'done',
    } as Record<string, string>;

    const wifiFromScan = 'ScannedWifi';
    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
      manualNetworkSetup: false,
      selectedNetwork: undefined,
      networkList: [wifiFromScan],
    };

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
      expect(result.current.showConfirmButton).toBe(false);
    });

    networkCtxValue = {
      ...networkCtxValue,
      selectedNetwork: wifiFromScan,
    };
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
      expect(result.current.showConfirmButton).toBe(true);
    });
  });

  it('allows confirmation even with a custom wifi not present in the list (manual setup)', async () => {
    isBoardMock = true;
    systemPropsMock = {
      [SystemPropKey.SetupBoardName]: 'done',
      [SystemPropKey.SetupKeyboard]: 'done',
    } as Record<string, string>;

    const wifiFromScan = 'ScannedWifi';
    const customWifi = 'MyHiddenWifi';

    networkCtxValue = {
      ...networkCtxValue,
      networkStatusChecked: true,
      isConnected: false,
      manualNetworkSetup: true,
      networkList: [wifiFromScan],
      selectedNetwork: customWifi,
    };

    const { result, rerender } = renderHook(
      () => createUseSetupLogic(createMockBoardsProps())(),
      {
        wrapper: ProvidersWrapper,
      },
    );

    await vi.runAllTimersAsync();
    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe(SetupItemId.NetworkSetup);
      expect(result.current.showConfirmButton).toBe(true);
    });
  });
});
