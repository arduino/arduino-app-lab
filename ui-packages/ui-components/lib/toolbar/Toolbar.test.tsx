import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RbacCapability, RbacValue } from '../rbac';
import Toolbar from './Toolbar';
import { ToolbarItemIds, ToolbarLogic } from './Toolbar.type';

vi.mock('./sub-components/share-sketch', () => ({
  default: (): null => null,
}));

const FULL_ACCESS: RbacValue = {
  [RbacCapability.EditSketch]: true,
  [RbacCapability.CreateSketch]: true,
  [RbacCapability.DeleteSketch]: true,
  [RbacCapability.UploadSketch]: true,
  [RbacCapability.CopyFromPreview]: true,
  [RbacCapability.UpdateThing]: true,
};

const VIEWER: RbacValue = {
  ...FULL_ACCESS,
  [RbacCapability.EditSketch]: false,
  [RbacCapability.CreateSketch]: false,
  [RbacCapability.DeleteSketch]: false,
  [RbacCapability.UploadSketch]: false,
};

const renderToolbar = (
  overrides: Partial<ReturnType<ToolbarLogic>> = {},
): ReturnType<ToolbarLogic>['clickHandlers'] => {
  const clickHandlers = {
    [ToolbarItemIds.VerifyButton]: vi.fn(),
    [ToolbarItemIds.UploadButton]: vi.fn(),
    [ToolbarItemIds.PendingButton]: vi.fn(),
    [ToolbarItemIds.AssociationNode]: vi.fn(),
    [ToolbarItemIds.OpenSerialMonitor]: vi.fn(),
    [ToolbarItemIds.OpenFlavourConfig]: vi.fn(),
    [ToolbarItemIds.DownloadSketch]: vi.fn(),
  };

  render(
    <Toolbar
      toolbarLogic={(): ReturnType<ToolbarLogic> => ({
        selectedFqbn: 'arduino:avr:uno',
        selectedBoard: 'Arduino Uno',
        selectedPort: '/dev/ttyACM0',
        selectedBoardIsIot: false,
        isIotSketch: false,
        isIotComponent: false,
        canUpload: { value: true },
        canVerify: true,
        isVerifying: false,
        isPending: false,
        isCreating: false,
        isUploading: { value: false },
        boardsConfigIsUnknown: false,
        clickHandlers,
        devices: { totalCount: 0 },
        markDevicesAsSeen: vi.fn(),
        manyPortsAvailable: false,
        disableBoardBubbleBadge: false,
        currentDeviceIsBusy: false,
        currentDeviceSupportsOta: false,
        switchToAltPort: vi.fn(),
        notificationElement: null,
        useChromeOsDeviceAssociation: false,
        shareSketchLogic: vi.fn(),
        shareToClassroomLogic: vi.fn(),
        ...overrides,
      })}
    />,
  );

  return clickHandlers;
};

describe('Toolbar', () => {
  it('shows Verify and Upload and hides Download with full access', () => {
    renderToolbar({ rbac: FULL_ACCESS });

    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Download Sketch' }),
    ).toBeNull();
  });

  it('hides Verify and Upload and shows Download for a viewer', () => {
    renderToolbar({ rbac: VIEWER });

    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Download Sketch' }),
    ).toBeTruthy();
  });

  it('does not open device selection for a viewer', () => {
    const clickHandlers = renderToolbar({ rbac: VIEWER });

    fireEvent.click(screen.getByRole('button', { name: /Arduino Uno/ }));

    expect(
      clickHandlers[ToolbarItemIds.AssociationNode],
    ).not.toHaveBeenCalled();
  });

  it('opens device selection with full access', () => {
    const clickHandlers = renderToolbar({ rbac: FULL_ACCESS });

    fireEvent.click(screen.getByRole('button', { name: /Arduino Uno/ }));

    expect(clickHandlers[ToolbarItemIds.AssociationNode]).toHaveBeenCalled();
  });

  it('shows a read-only label instead of the device selector for a viewer with no board', () => {
    renderToolbar({
      rbac: VIEWER,
      selectedFqbn: undefined,
      selectedBoard: undefined,
      selectedPort: undefined,
    });

    expect(screen.getByText('No device selected yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select device' })).toBeNull();
  });

  describe('on ChromeOS', () => {
    it('shows the device selection buttons with full access', () => {
      const clickHandlers = renderToolbar({
        rbac: FULL_ACCESS,
        useChromeOsDeviceAssociation: true,
      });

      expect(document.querySelector('#select-device-button')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Arduino Uno/ }));
      expect(clickHandlers[ToolbarItemIds.AssociationNode]).toHaveBeenCalled();
    });

    it.each([
      ['a viewer', VIEWER],
      [
        'a role that can upload but not edit',
        { ...FULL_ACCESS, [RbacCapability.EditSketch]: false },
      ],
    ])('keeps the device selector read-only for %s', (_, rbac) => {
      const clickHandlers = renderToolbar({
        rbac,
        useChromeOsDeviceAssociation: true,
      });

      expect(document.querySelector('#select-device-button')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Arduino Uno/ }));
      expect(
        clickHandlers[ToolbarItemIds.AssociationNode],
      ).not.toHaveBeenCalled();
    });
  });
});
