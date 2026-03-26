import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNetwork } from './networkContextProvider.logic';
enum SecurityProtocols {
  WPA = 'WPA',
  WPA2 = 'WPA2',
}
let boardIsReachableMock = true;

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');

  return {
    ...actual,
    useBoardLifecycleStore: vi.fn((selector) =>
      selector({
        boardIsReachable: boardIsReachableMock,
      }),
    ),
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
      getWiFiStatus: vi.fn(),
      getEthernetStatus: vi.fn(),
      getInternetStatus: vi.fn(),
      getNetworkList: vi.fn(),
      connectToWiFi: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);

const createWrapper = () =>
  function NetworkTestWrapper({ children }: PropsWithChildren): JSX.Element {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

beforeEach(() => {
  vi.clearAllMocks();
  boardIsReachableMock = true;

  domainServices.getWiFiStatus.mockResolvedValue('disconnected');
  domainServices.getEthernetStatus.mockResolvedValue('disconnected');
  domainServices.getInternetStatus.mockResolvedValue(false);
  domainServices.getNetworkList.mockResolvedValue([]);
  domainServices.connectToWiFi.mockResolvedValue(undefined);
});

describe('useNetwork - scanNetworkList', () => {
  it('scanNetworkList updates the list of Wi-Fi networks', async () => {
    boardIsReachableMock = true;

    const mockList = ['wifi-1', 'wifi-2'];

    domainServices.getNetworkList.mockResolvedValue(mockList);

    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setScanningIsEnabled(true);
    });

    await waitFor(() => {
      expect(result.current.networkList).toEqual(mockList);
    });

    await act(async () => {
      result.current.scanNetworkList();
    });

    expect(domainServices.getNetworkList).toHaveBeenCalled();
    expect(result.current.networkList).toEqual(mockList);
  });
});

describe('useNetwork - connectToWifiNetwork', () => {
  it('calls connectToWiFi and, with the internet reachable, sets isConnected = true', async () => {
    boardIsReachableMock = true;

    domainServices.getWiFiStatus
      .mockResolvedValueOnce('disconnected')
      .mockResolvedValue('connected');
    domainServices.getEthernetStatus.mockResolvedValue('disconnected');
    domainServices.getInternetStatus.mockResolvedValue(true);

    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.networkStatusChecked).toBe(true);
    });

    await act(async () => {
      result.current.connectToWifiNetwork({
        name: 'MyWiFi',
        password: 'super-secret',
        security: SecurityProtocols.WPA2,
      });
    });

    await waitFor(() => {
      expect(domainServices.connectToWiFi).toHaveBeenCalledWith(
        'MyWiFi',
        'super-secret',
      );
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectRequestIsSuccess).toBe(true);
      expect(result.current.connectRequestIsError).toBe(false);
    });
  });

  it('If the mutation fails, it exposes connectRequestIsError = true and isConnected = false', async () => {
    boardIsReachableMock = true;

    domainServices.getWiFiStatus.mockResolvedValue('disconnected');
    domainServices.getEthernetStatus.mockResolvedValue('disconnected');
    domainServices.getInternetStatus.mockResolvedValue(false);

    const originalConsoleError = console.error;
    console.error = vi.fn();
    domainServices.connectToWiFi.mockRejectedValue(
      new Error('generic wifi error'),
    );

    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.networkStatusChecked).toBe(true);
    });

    await act(async () => {
      result.current.connectToWifiNetwork({
        name: 'BrokenWiFi',
        password: 'pwd',
        security: SecurityProtocols.WPA,
      });
    });

    await waitFor(() => {
      expect(domainServices.connectToWiFi).toHaveBeenCalledWith(
        'BrokenWiFi',
        'pwd',
      );
      expect(result.current.connectRequestIsError).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });

    console.error = originalConsoleError;
  });
});

describe('useNetwork - selectedNetwork e manualNetworkSetup', () => {
  it('exposes the setters for selectedNetwork and manualNetworkSetup', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: createWrapper(),
    });

    const network = 'wifi-1';

    act(() => {
      result.current.setSelectedNetwork(network);
      result.current.setManualNetworkSetup(true);
    });

    expect(result.current.selectedNetwork).toEqual(network);
    expect(result.current.manualNetworkSetup).toBe(true);
  });
});
