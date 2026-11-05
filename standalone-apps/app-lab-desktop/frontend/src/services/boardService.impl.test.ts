import type { HwStatusMount } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { app } = vi.hoisted(() => ({
  app: {
    HwAvailable: vi.fn(async () => true),
    HwEnable: vi.fn(async () => undefined),
    HwDisable: vi.fn(async () => undefined),
    SetBoardName: vi.fn(),
    SetKeyboardLayout: vi.fn(),
    SetUserPassword: vi.fn(),
    IsUserPasswordSet: vi.fn(),
    GetNetworkModeStatus: vi.fn(),
  },
}));

vi.mock('../../wailsjs/go/app/App', () => app);
// The real modules pull in the whole component library, which does not load in
// the test environment.
vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  () => ({
    HwError: class extends Error {},
    HwErrorCode: {},
  }),
);
vi.mock('@cloud-editor-mono/core-ui/app-lab/persistent-store', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

import {
  isNetworkModeEnabled,
  isUserPasswordSet,
  setBoardName,
  setHwStatus,
  setKeyboardLayout,
  setUserPassword,
} from './boardService.impl.standalone';

const carrier = (overrides: Partial<HwStatusMount>): HwStatusMount => ({
  name: 'mipi',
  kind: 'carrier',
  currentEnabled: false,
  nextEnabled: false,
  currentDevices: [{ device: 'camera0', option: 'none', deviceType: 'camera' }],
  nextDevices: [{ device: 'camera0', option: 'none', deviceType: 'camera' }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setHwStatus', () => {
  it('enables a carrier switched on with every option left on none', async () => {
    await setHwStatus({ mounts: [carrier({ nextEnabled: true })] }, 'pw');

    expect(app.HwEnable).toHaveBeenCalledWith('pw', 'mipi', [
      { Device: 'camera0', Option: 'none' },
    ]);
    expect(app.HwDisable).not.toHaveBeenCalled();
  });

  it('leaves an untouched disabled carrier alone', async () => {
    await setHwStatus({ mounts: [carrier({})] }, 'pw');

    expect(app.HwEnable).not.toHaveBeenCalled();
    expect(app.HwDisable).not.toHaveBeenCalled();
  });

  it('disables an enabled carrier switched off', async () => {
    await setHwStatus(
      { mounts: [carrier({ currentEnabled: true, nextEnabled: false })] },
      'pw',
    );

    expect(app.HwDisable).toHaveBeenCalledWith('pw', 'mipi');
    expect(app.HwEnable).not.toHaveBeenCalled();
  });
});

describe('Wails rejections', () => {
  it.each([
    [
      'setBoardName',
      (): Promise<void> => setBoardName('board'),
      app.SetBoardName,
    ],
    [
      'setKeyboardLayout',
      (): Promise<void> => setKeyboardLayout('us'),
      app.SetKeyboardLayout,
    ],
    [
      'setUserPassword',
      (): Promise<void> => setUserPassword('secret'),
      app.SetUserPassword,
    ],
  ])('%s rejects with the Wails error', async (_, call, wailsFn) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    wailsFn.mockRejectedValueOnce('ssh failed');

    await expect(call()).rejects.toBe('ssh failed');
  });

  it('setUserPassword does not log the password', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    app.SetUserPassword.mockRejectedValueOnce('ssh failed');

    await expect(setUserPassword('secret')).rejects.toBe('ssh failed');

    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });

  it.each([
    ['isUserPasswordSet', isUserPasswordSet, app.IsUserPasswordSet],
    ['isNetworkModeEnabled', isNetworkModeEnabled, app.GetNetworkModeStatus],
  ])('%s returns false when Wails rejects', async (_, call, wailsFn) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    wailsFn.mockRejectedValueOnce('ssh failed');

    await expect(call()).resolves.toBe(false);
  });
});
