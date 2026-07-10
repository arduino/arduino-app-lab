import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React, { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBoardConfiguration } from './boardConfigurationContextProvider.logic';

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');

  const mockState = {
    boardIsReachable: true,
    selectedConnectedBoard: { name: 'Test Board', type: 'uno' },
  };

  const useBoardLifecycleStoreMock = Object.assign(
    vi.fn((selector) => {
      if (typeof selector === 'function') {
        return selector(mockState);
      }
      return mockState;
    }),
    {
      getState: vi.fn(() => mockState),
      setState: vi.fn(),
    },
  );

  return {
    ...actual,
    useBoardLifecycleStore: useBoardLifecycleStoreMock,
  };
});

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  async () => {
    const actual = await vi.importActual<
      typeof import('@cloud-editor-mono/domain/src/services/services-by-app/app-lab')
    >('@cloud-editor-mono/domain/src/services/services-by-app/app-lab');

    return {
      ...actual,
      getBoardName: vi.fn(),
      setBoardName: vi.fn(),
      getKeyboardLayout: vi.fn(),
      listKeyboardLayouts: vi.fn(),
      setKeyboardLayout: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);

const getBoardNameMock = domainServices.getBoardName;
const setBoardNameMock = domainServices.setBoardName;
const getKeyboardLayoutMock = domainServices.getKeyboardLayout;
const listKeyboardLayoutsMock = domainServices.listKeyboardLayouts;
const setKeyboardLayoutMock = domainServices.setKeyboardLayout;

const createWrapper = (): React.FC<PropsWithChildren> => {
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => {
    const client = new QueryClient();
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  // default behaviour service
  getBoardNameMock.mockResolvedValue('My Board');
  getKeyboardLayoutMock.mockResolvedValue('us');
  listKeyboardLayoutsMock.mockResolvedValue([
    { id: 'us', label: 'US' },
    { id: 'it', label: 'Italian' },
  ]);
  setBoardNameMock.mockResolvedValue(undefined);
  setKeyboardLayoutMock.mockResolvedValue(undefined);
});

describe('useBoardConfiguration - bootstrap & base state', () => {
  it('loads board name, keyboard layout and layout list when board is reachable', async () => {
    const { result } = renderHook(() => useBoardConfiguration(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.boardName).toBe('My Board');
      },
      { timeout: 1000 },
    );

    expect(getBoardNameMock).toHaveBeenCalledTimes(1);
    expect(getKeyboardLayoutMock).toHaveBeenCalledTimes(1);
    expect(listKeyboardLayoutsMock).toHaveBeenCalledTimes(1);

    expect(result.current.keyboardLayout).toBe('us');
    expect(result.current.keyboardLayouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'us' }),
        expect.objectContaining({ id: 'it' }),
      ]),
    );
  });
});

describe('useBoardConfiguration - checkBoardName', () => {
  it('returns false for empty name or whitespace only', async () => {
    const { result } = renderHook(() => useBoardConfiguration(), {
      wrapper: createWrapper(),
    });
    expect(result.current.checkBoardName('')).toBe(false);
    expect(result.current.checkBoardName('   ')).toBe(false);
  });

  it('returns true for valid name', async () => {
    const { result } = renderHook(() => useBoardConfiguration(), {
      wrapper: createWrapper(),
    });

    expect(result.current.checkBoardName('MyBoard123')).toBe(true);
  });
});

describe('useBoardConfiguration - setBoardConfiguration happy path', () => {
  it('calls services and sets success flags when name and layout are valid', async () => {
    const { result } = renderHook(() => useBoardConfiguration(), {
      wrapper: createWrapper(),
    });

    result.current.setBoardConfiguration('NewBoard', 'it');

    await waitFor(
      () => {
        expect(result.current.setBoardConfigurationIsSuccess).toBe(true);
      },
      { timeout: 1000 },
    );

    expect(setBoardNameMock).toHaveBeenCalledWith('NewBoard');
    expect(setKeyboardLayoutMock).toHaveBeenCalledWith('it');

    expect(result.current.setBoardNameIsSuccess).toBe(true);
    expect(result.current.setKeyboardLayoutIsSuccess).toBe(true);
    expect(result.current.hasBoardConfigurationError).toBe(false);
    expect(result.current.setBoardNameIsError).toBe(false);
    expect(result.current.setKeyboardLayoutIsError).toBe(false);
  });
});
