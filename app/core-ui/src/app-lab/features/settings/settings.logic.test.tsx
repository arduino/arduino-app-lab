import type { HwStatus } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  renderHook,
  RenderHookResult,
  waitFor,
} from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemPropKey } from '../../store/systemProps';
import { createUseSettingsLogic } from './settings.logic';

const { systemProps, upsertProp } = vi.hoisted(() => ({
  systemProps: {} as Record<string, string>,
  upsertProp: vi.fn(async () => 'true'),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');

  return {
    ...actual,
    useBoardLifecycleStore: vi.fn((selector) =>
      selector({
        boardIsReachable: true,
        selectedConnectedBoard: undefined,
        needsImageUpdate: false,
        setBoardIsFlashing: vi.fn(),
      }),
    ),
  };
});

vi.mock('../../hooks/useSystemProps', () => ({
  useSystemProps: (): unknown => ({ systemProps, upsertProp }),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  async () => {
    const actual = await vi.importActual<
      typeof import('@cloud-editor-mono/domain/src/services/services-by-app/app-lab')
    >('@cloud-editor-mono/domain/src/services/services-by-app/app-lab');

    return {
      ...actual,
      isBoard: vi.fn(async () => false),
      isHwSupported: vi.fn(),
      getHwList: vi.fn(),
      getHwStatus: vi.fn(),
      listTerminals: vi.fn(),
      getTerminalPreference: vi.fn(),
      setTerminalPreference: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);

const hwStatus: HwStatus = {
  mounts: [
    {
      name: 'mipi',
      kind: 'carrier',
      currentEnabled: false,
      nextEnabled: false,
      currentDevices: [
        { device: 'camera0', option: 'none', deviceType: 'camera' },
      ],
      nextDevices: [
        { device: 'camera0', option: 'none', deviceType: 'camera' },
      ],
    },
    {
      name: 'automation',
      kind: 'hat',
      currentEnabled: false,
      nextEnabled: false,
      currentDevices: [],
      nextDevices: [],
    },
  ],
};

const wrapper = ({ children }: PropsWithChildren): JSX.Element => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <IntlProvider locale="en">{children}</IntlProvider>
  </QueryClientProvider>
);

const useSettingsLogic = createUseSettingsLogic();

type ExtensionsLogic = ReturnType<
  ReturnType<typeof useSettingsLogic>['boardExtensionsSettingsLogic']
>;

const renderLogic = async (): Promise<
  RenderHookResult<ExtensionsLogic, unknown>
> => {
  const view = renderHook(
    () => useSettingsLogic().boardExtensionsSettingsLogic(),
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.hats).toHaveLength(1));
  return view;
};

const selectedHat = (status: HwStatus): string | undefined =>
  status.mounts.find((mount) => mount.kind === 'hat' && mount.nextEnabled)
    ?.name;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(systemProps)) delete systemProps[key];
  domainServices.isHwSupported.mockResolvedValue(true);
  domainServices.getHwList.mockResolvedValue({
    mounts: [
      {
        name: 'mipi',
        kind: 'carrier',
        osSupport: true,
        devices: [
          {
            name: 'camera0',
            deviceType: 'camera',
            options: ['none', 'imx219'],
            osSupport: true,
          },
        ],
      },
      { name: 'automation', kind: 'hat', osSupport: true, devices: [] },
    ],
  });
  domainServices.getHwStatus.mockResolvedValue(hwStatus);
  domainServices.listTerminals.mockResolvedValue({
    supported: true,
    terminals: [
      {
        id: 'alacritty',
        label: 'Alacritty',
        path: '/usr/bin/alacritty',
        available: true,
      },
    ],
  });
  domainServices.getTerminalPreference.mockResolvedValue('');
  domainServices.setTerminalPreference.mockResolvedValue(undefined);
});

describe('board extensions settings logic', () => {
  it('reports the board as supported while the check is pending', () => {
    domainServices.isHwSupported.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(
      () => useSettingsLogic().boardExtensionsSettingsLogic(),
      { wrapper },
    );

    expect(result.current.supported).toBe(true);
  });

  it('switches the carrier on when the dialog opened by its toggle is confirmed', async () => {
    const { result } = await renderLogic();

    act(() => result.current.onCarrierEnabledChange(true));
    expect(result.current.attachLogic().open).toBe(true);
    expect(result.current.carrierEnabled).toBe(false);

    act(() => result.current.attachLogic().confirm());
    expect(upsertProp).toHaveBeenCalledWith({
      key: SystemPropKey.CarrierAcknowledged,
      value: 'true',
    });
    expect(result.current.carrierEnabled).toBe(true);
    expect(result.current.carrierPristine).toBe(false);
  });

  it('leaves the carrier off when the "How to attach" dialog is confirmed', async () => {
    const { result } = await renderLogic();

    act(() => result.current.openAttachCarrierDialog());
    act(() => result.current.attachLogic().confirm());

    expect(result.current.carrierEnabled).toBe(false);
    expect(result.current.carrierPristine).toBe(true);
  });

  it('keeps the chosen HAT when the dialog opened by the HAT menu is confirmed', async () => {
    const { result } = await renderLogic();

    act(() => result.current.setHatStatus('automation'));
    expect(result.current.attachLogic().open).toBe(true);

    act(() => result.current.attachLogic().confirm());
    expect(selectedHat(result.current.status)).toBe('automation');
    expect(result.current.hatPristine).toBe(false);
  });

  it('does not open the dialog for a HAT choice once HATs are acknowledged', async () => {
    systemProps[SystemPropKey.HatAcknowledged] = 'true';
    const { result } = await renderLogic();

    act(() => result.current.onHatEnabledChange(true));
    act(() => result.current.setHatStatus('automation'));

    expect(result.current.attachLogic().open).toBe(false);
    expect(selectedHat(result.current.status)).toBe('automation');
  });
});

describe('terminal settings logic', () => {
  const renderTerminalLogic = async (): Promise<
    RenderHookResult<
      ReturnType<ReturnType<typeof useSettingsLogic>['terminalSettingsLogic']>,
      unknown
    >
  > => {
    const view = renderHook(() => useSettingsLogic().terminalSettingsLogic(), {
      wrapper,
    });
    await waitFor(() => expect(view.result.current.supported).toBe(true));
    return view;
  };

  it('lists the terminal emulators detected on the system', async () => {
    const { result } = await renderTerminalLogic();

    expect(result.current.terminals).toHaveLength(1);
    expect(result.current.terminals[0].id).toBe('alacritty');
  });

  it('reports the terminal as not selectable when the platform has a fixed one', async () => {
    domainServices.listTerminals.mockResolvedValue({
      supported: false,
      terminals: [],
    });

    const { result } = renderHook(
      () => useSettingsLogic().terminalSettingsLogic(),
      { wrapper },
    );

    await waitFor(() => expect(result.current.supported).toBe(false));
  });

  it('keeps the terminal selected by the user', async () => {
    domainServices.getTerminalPreference.mockResolvedValue('alacritty');

    const { result } = await renderTerminalLogic();

    expect(result.current.preference).toBe('alacritty');
  });

  it('persists the terminal selected by the user', async () => {
    const { result } = await renderTerminalLogic();

    await act(async () => {
      await result.current.setPreference('alacritty');
    });

    expect(domainServices.setTerminalPreference).toHaveBeenCalledWith(
      'alacritty',
    );
  });
});
