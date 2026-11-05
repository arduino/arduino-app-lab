export { default as CodeBlock } from './code-block/CodeBlock';
export { getInitials } from './common/utils';
export { default as ConsolePanel } from './console-panel/ConsolePanel';
export {
  type ConsolePanelLogic,
  ConsolePanelStatus,
  OutputStringType,
} from './console-panel/consolePanel.type';
export { DetailsWrapper } from './details-wrapper';
export {
  type DetectedDevice,
  type DetectedDevices,
  type DeviceAssociationDialogLinkDictionary,
  type DeviceAssociationDialogLogic,
  type Devices,
  type IotDevicesGroups,
  type SetDetectedBoardAndPort,
  type SetDetectedUnknownBoard,
  type SetUndetectedBoard,
  type UnknownDeviceIdentifiers,
  DetectedDevicesGroup,
  DeviceAssociationDialog,
  DeviceAssociationDialogLinks,
  DeviceAssociationSteps,
  UNKNOWN_BOARD_NAME,
} from './device-association-dialog';
export * from './dialogs';
export * from '@cloud-editor-mono/ide-workbench/lib/code-editor/index';
export * from '@cloud-editor-mono/ide-workbench/lib/code-mirror/index';
export { EditorControl } from '@cloud-editor-mono/ide-workbench/lib/editor-controls/index';
export {
  type EditorControlsProps,
  type EditorPanelLogic,
  type PaneContentContext,
  type PaneContentRenderer,
  EditorPanel,
} from '@cloud-editor-mono/ide-workbench/lib/editor-panel/index';
export {
  type AddFileHandler,
  type DeleteFileHandler,
  type FileNameValidationItem,
  type FileNameValidationResult,
  type MakeUniqueFileName,
  type OnBeforeFileAction,
  type RenameFileHandler,
  type SelectableFileData,
  type TabsBarLogic,
  type ValidateFileName,
  EditorTabsBar,
  FileNameValidation,
  NewTabMenuItemIds,
  SUPPORTED_IMAGE_TYPES,
  TabMenuItemIds,
} from '@cloud-editor-mono/ide-workbench/lib/editor-tabs-bar/index';
// DeleteFileDialog (+ its Data/Logic types) moved to dialogs/editor and
// flows through the './dialogs' star export above (ADR-0002 phase 4a-0a:
// the dialog is rendered by apps, not by the editor cluster).
export * from './essential/button';
export {
  type ConfirmActionDialogLogic,
  type ConfirmActionDialogProps,
  ConfirmActionDialog,
} from './essential/confirm-action-dialog';
export * from './essential/copy-to-clipboard';
export { type DialogProps, type ModalLogic, Dialog } from './essential/dialog';
export {
  type DropdownMenuItemType,
  type DropdownMenuSectionType,
  DropdownMenuItem,
  DropdownMenuSection,
} from './essential/dropdown-menu';
export * from './essential/generic-dialog';
export { HintLabel } from './essential/hint-label';
export { IconButton } from './essential/icon-button';
export * from './essential/input';
export { ArduinoLoader, Loader } from './essential/loader';
export {
  type NotificationsLogic,
  type OnToastUnmount,
  type ToastActionItems,
  type ToastDismissal,
  type ToastOnCloseHandler,
  Notifications,
  ToastIcon,
  ToastSize,
  ToastType,
} from './essential/notifications';
export { NumberField } from './essential/number-field';
export { default as ProgressBar } from './essential/progress-bar/ProgressBar';
export { Radio, RadioGroup } from './essential/radio-group';
export { default as SearchField } from './essential/search-field/SearchField';
export { ToggleButton } from './essential/toggle-button';
export { type GenAiBannerLogic, GenAiBanner } from './gen-ai-banner';
export { type FormatMessage, useI18n } from './i18n/useI18n';
export { type OnboardingLogic, Onboarding } from './onboarding';
export * from './rbac';
export {
  type ReadOnlyActionButtonsProps,
  type ReadOnlyBarLogic,
  ReadOnlyBar,
} from './ready-only-bar';
export * from './secrets-editor';
export {
  type ContentUpdateLogic,
  type SerialMonitorLogic,
  SerialMonitor,
  SerialMonitorStatus,
} from './serial-monitor';
export * from './sidenav';
export { Skeleton } from './skeleton';
export * from './snackbar';
export { default as SplitConsole } from './split-console/SplitConsole';
export {
  type IsUploading,
  type PopulatedToolbarDevicesData,
  type SetToolbarSelection,
  type ToolbarLogic,
  type UnpopulatedToolbarDevicesData,
  flavourButtonId,
  IotPortName,
  isPopulatedToolbarDevicesData,
  Toolbar,
  ToolbarActionBlockingReasons,
  ToolbarItemIds,
} from './toolbar';
export * from './typography';
export * from './utils';
