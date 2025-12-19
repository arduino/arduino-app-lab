import { MessageDescriptor } from 'react-intl';

import {
  ShareSketchDialogLogic,
  ShareToClassroomDialogLogic,
} from '../dialogs';
import { FormatMessage } from '../i18n/useI18n';

export type SetToolbarSelection = (...args: any) => any;

export type ShareSketchLogic = ShareSketchDialogLogic;
export type ShareToClassroomLogic = ShareToClassroomDialogLogic;

export enum ToolbarItemIds {
  VerifyButton = 'verify-button',
  UploadButton = 'upload-button',
  PendingButton = 'pending-button',
  CreatingButton = 'creating-button',
  AssociationNode = 'association-node',
  OpenSerialMonitor = 'open-serial-monitor',
  OpenFlavourConfig = 'open-flavour-config',
  ShareSketch = 'share-sketch',
  DownloadSketch = 'download-sketch',
}

export type ToolbarItemDictionary = {
  [ToolbarItemIds.AssociationNode]: AssociationNodeButton<ToolbarItemIds.AssociationNode>;
  [ToolbarItemIds.OpenSerialMonitor]: OpenSerialMonitorButton<ToolbarItemIds.OpenSerialMonitor>;
  [ToolbarItemIds.CreatingButton]: CreatingButtonHandler;
  [ToolbarItemIds.PendingButton]: PendingButtonHandler;
  [ToolbarItemIds.VerifyButton]: GenericHandler<ToolbarItemIds.VerifyButton>;
  [ToolbarItemIds.UploadButton]: GenericHandler<ToolbarItemIds.UploadButton>;
  [ToolbarItemIds.OpenFlavourConfig]: GenericHandler<ToolbarItemIds.OpenFlavourConfig>;
  [ToolbarItemIds.ShareSketch]: ShareSketchButtonHandler;
  [ToolbarItemIds.DownloadSketch]: GenericHandler<ToolbarItemIds.DownloadSketch>;
};

type AssociationNodeButton<K extends keyof ToolbarClickHandlerDictionary> = (
  formatMessage: FormatMessage,
  onClickHandler: ToolbarClickHandlerDictionary[K],
  boardBubbleBadgeNumber: number,
  renderPopover?: () => JSX.Element | null,
) => React.ReactNode;

type OpenSerialMonitorButton<K extends keyof ToolbarClickHandlerDictionary> = (
  onClickHandler?: ToolbarClickHandlerDictionary[K],
) => React.ReactNode;

type CreatingButtonHandler = (
  formatMessage: FormatMessage,
  busyState?: ToolbarBusyState,
) => React.ReactNode;

type PendingButtonHandler = (
  formatMessage: FormatMessage,
  onClick?: (...args: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  busyState?: ToolbarBusyState,
  commandsState?: ToolbarCommandsState,
) => React.ReactNode;

type ShareSketchButtonHandler = (
  shareSketchLogic: ShareSketchLogic,
  shareToClassroomLogic: ShareToClassroomLogic,
) => React.ReactNode;

type GenericHandler<K extends keyof ToolbarClickHandlerDictionary> = (
  formatMessage: FormatMessage,
  onClickHandler: ToolbarClickHandlerDictionary[K],
  busyState?: ToolbarBusyState,
  commandsState?: ToolbarCommandsState,
  renderPopover?: () => JSX.Element | null,
) => React.ReactNode;

export type ToolbarClickHandlerDictionary = {
  [K in Exclude<ToolbarItemIds, 'creating-button' | 'share-sketch'>]: (
    ...args: any
  ) => any;
};

export enum ToolbarActionBlockingReasons {
  NoNetwork,
  CompileLimitExceeded,
  VerifyBackendDown,
  UploadBackendDown,
  VerifyAndUploadBackendsDown,
  MissingInfo,
  Offline,
  MissingIotDeviceInfo,
  LoadingUserRestrictions,
  sketchDataIncompleteForCommands,
  BlockedOta,
  OtaIncompatible,
  PortBusy,
  IoTDeviceNotFound,
  OTAInProgressUnknown,
}
interface ToolbarCannotUploadPopover {
  title: MessageDescriptor;
  message: MessageDescriptor;
  messageBold?: MessageDescriptor;
  link?: {
    url: string;
    label: MessageDescriptor;
  };
}

type ToolbarLogicCanUpload =
  | { value: true }
  | {
      value: false;
      reason: ToolbarActionBlockingReasons;
      popover?: ToolbarCannotUploadPopover;
    };

export type IsUploading =
  | {
      value: true;
      phase: 'verify' | 'upload';
    }
  | {
      value: false;
    };

export interface PopulatedToolbarDevicesData {
  totalCount: number;
  ids: string[];
}

export interface UnpopulatedToolbarDevicesData {
  totalCount: 0;
}

export function isPopulatedToolbarDevicesData(
  data: ReturnType<ToolbarLogic>['devices'],
): data is PopulatedToolbarDevicesData {
  return Boolean((data as PopulatedToolbarDevicesData).ids);
}

export type ToolbarLogic = () => {
  selectedFqbn?: string;
  selectedBoard?: string;
  selectedPort?: string;
  selectedBoardIsIot: boolean;
  isIotSketch: boolean;
  isIotComponent: boolean;
  canUpload: ToolbarLogicCanUpload;
  canVerify: boolean;
  isVerifying: boolean;
  isPending: boolean;
  isCreating: boolean;
  isUploading: IsUploading;
  boardsConfigIsUnknown: boolean;
  clickHandlers: ToolbarClickHandlerDictionary;
  devices: PopulatedToolbarDevicesData | UnpopulatedToolbarDevicesData;
  markDevicesAsSeen: () => void;
  manyPortsAvailable: boolean;
  disableBoardBubbleBadge: boolean;
  currentDeviceIsBusy: boolean;
  currentDeviceSupportsOta: boolean;
  selectedPortBoardId?: string;
  selectedDeviceAltPortBoardId?: string;
  switchToAltPort: () => void;
  notificationElement: React.ReactNode;
  useChromeOsDeviceAssociation: boolean;
  deviceSetupLink?: string;
  shareSketchLogic: () => ReturnType<ShareSketchLogic>;
  shareToClassroomLogic: () => ReturnType<ShareToClassroomLogic>;
};

export enum ToolbarBusyState {
  Loading,
  Verifying,
  Uploading,
  Pending,
  Creating,
}

export enum ToolbarCommandsState {
  cannotVerify,
  cannotUpload,
  cannotVerifyOrUpload,
  canVerifyAndUpload,
  canProgramIot,
}

export enum IotPortName {
  Online = 'iot-online',
  Offline = 'iot-offline',
}
