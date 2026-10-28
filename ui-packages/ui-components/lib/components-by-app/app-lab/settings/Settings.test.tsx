import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

// Browser APIs jsdom lacks: the app-lab barrel Settings imports from also
// pulls in the serial monitor, which constructs a web worker at import time.
vi.hoisted(() => {
  const noop = (): void => undefined;

  globalThis.Worker = class {
    addEventListener = noop;
    postMessage = noop;
    terminate = noop;
  } as unknown as typeof Worker;

  globalThis.ResizeObserver = class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  } as unknown as typeof ResizeObserver;
});

import { PasswordDialogLogic } from '../../../dialogs/app-lab/password-dialog/PasswordDialog';
import { Settings } from './Settings';
import { UseSettingsLogic, UseSystemSettingsLogic } from './settings.type';

const closedDialog = {
  open: false,
  onOpenChange: vi.fn(),
  confirm: vi.fn().mockResolvedValue(undefined),
};

const passwordLogic = (): PasswordDialogLogic => () => ({
  open: false,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  isLoading: false,
  isSuccess: false,
});

// Each button's label is repeated by its tooltip and by a visually hidden span.
const clickButton = (label: string): void => {
  fireEvent.click(
    screen.getByText(label, {
      ignore: '.visually-hidden, [role="tooltip"] *',
    }),
  );
};

const renderSettings = ({
  isBoard = false,
  system = {},
}: {
  isBoard?: boolean;
  system?: Partial<ReturnType<UseSystemSettingsLogic>>;
} = {}): ReturnType<UseSystemSettingsLogic> => {
  const systemLogic: ReturnType<UseSystemSettingsLogic> = {
    hasBoardUpdate: false,
    needsImageUpdate: false,
    openFlasher: vi.fn(),
    startUpdate: vi.fn(),
    ...system,
  };

  const settingsLogic: UseSettingsLogic = () => ({
    cloudConnectorSettingsLogic: () => ({
      status: undefined,
      connectBoard: vi.fn(),
      disconnectBoard: vi.fn(),
      connectDialogLogic: vi.fn(),
      disconnectDialogLogic: vi.fn(),
      isConnecting: false,
      isDisconnecting: false,
    }),
    boardSettingsLogic: () => ({
      isBoard,
      keyboardLayout: undefined,
      keyboardLayouts: [],
      bytesToGiB: () => '0',
      setBoardName: vi.fn(),
      setKeyboardLayout: vi.fn(),
      setBoardNameIsError: false,
      boardNameErrorMsg: '',
    }),
    boardExtensionsSettingsLogic: () => ({
      carrierEnabled: false,
      carrierPristine: true,
      onCarrierEnabledChange: vi.fn(),
      carriers: [],
      status: { mounts: [] },
      setCarrierStatus: vi.fn(),
      supported: true,
      attachLogic: () => ({
        ...closedDialog,
        isHat: false,
        isVentunoQ: false,
      }),
      openAttachCarrierDialog: vi.fn(),
      openAttachHatDialog: vi.fn(),
      passwordLogic: passwordLogic(),
      openPasswordDialog: vi.fn(),
      hatEnabled: false,
      hatPristine: true,
      onHatEnabledChange: vi.fn(),
      hats: [],
      setHatStatus: vi.fn(),
    }),
    networkModeLogic: () => ({
      passwordLogic: passwordLogic(),
      openPasswordDialog: vi.fn(),
    }),
    networkSettingsLogic: () => ({
      openNetworkSettingsDialog: vi.fn(),
    }),
    systemSettingsLogic: () => systemLogic,
    terminalSettingsLogic: () => ({
      supported: false,
      terminals: [],
      preference: '',
      setPreference: vi.fn(),
    }),
    passwordSettingsLogic: () => ({
      changePasswordLogic: () => ({
        open: false,
        onOpenChange: vi.fn(),
        setUserPassword: vi.fn(),
        isLoading: false,
        confirmationIsError: false,
        isError: false,
        isSuccess: false,
        errorMsg: '',
        confirmationErrorMsg: '',
      }),
      openChangePasswordDialog: vi.fn(),
    }),
    onOpenExternal: vi.fn(),
  });

  render(
    <IntlProvider locale="en">
      <Settings settingsLogic={settingsLogic} />
    </IntlProvider>,
  );
  return systemLogic;
};

describe('Settings, Operating system section', () => {
  it('opens the flasher from "Update now" when App Lab runs on a PC', () => {
    const system = renderSettings({ system: { needsImageUpdate: true } });

    clickButton('Update now');

    expect(system.openFlasher).toHaveBeenCalledTimes(1);
    expect(system.startUpdate).not.toHaveBeenCalled();
  });

  it('keeps "Update now" on startUpdate in SBC mode', () => {
    const system = renderSettings({
      isBoard: true,
      system: { needsImageUpdate: true },
    });

    clickButton('Update now');

    expect(system.startUpdate).toHaveBeenCalledTimes(1);
    expect(system.openFlasher).not.toHaveBeenCalled();
  });

  it('keeps the System version "Update" button on startUpdate', () => {
    const system = renderSettings({ system: { hasBoardUpdate: true } });

    clickButton('Update');

    expect(system.startUpdate).toHaveBeenCalledTimes(1);
    expect(system.openFlasher).not.toHaveBeenCalled();
  });
});
