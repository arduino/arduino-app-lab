import { BehaviorSubject, Subject } from 'rxjs';

import { UseMonitorCodeMirror } from './hooks/useMonitorCodeMirror';

export enum SerialMonitorStatus {
  Connecting = 'connecting',
  Active = 'active',
  Paused = 'paused',
  ActiveUnreachable = 'active/unreachable',
  PausedUnreachable = 'paused/unreachable',
  Starting = 'starting',
  Uploading = 'uploading',
  Unavailable = 'unavailable',
}

export type ContentUpdateLogic = (
  receiveContentUpdate: (
    content: string,
    isSentByUser: boolean,
    className?: string,
    isGlobalStyle?: boolean,
  ) => void,
  receiveContentReset: () => void,
  resetSource?: Subject<void>, // Optional reset source for resetting content
) => void;

export type SerialMonitorLogicResult = {
  deviceName?: string;
  portName?: string;
  contentUpdateLogic: ContentUpdateLogic;
  baudRates: number[];
  selectedBaudRate: number;
  onBaudRateSelected: (baudRate: number) => void;
  onPlayPause: () => void;
  onMessageSend: (message: string) => void;
  clearMessages: VoidFunction;
  status: SerialMonitorStatus;
  disabled: boolean;
};

export type SerialMonitorLogic = <T = unknown>(
  subject?: BehaviorSubject<T> | Subject<T>,
) => SerialMonitorLogicResult;

export type SerialMonitorProps<T = unknown> = {
  serialMonitorLogic: SerialMonitorLogic;
  classes?: {
    wrapper?: string;
    contents?: {
      content?: string;
      wrapper?: string;
      viewNewDataButton?: string;
    };
    actions?: SerialMonitorActionsProps['classes'];
  };
  logSource?: BehaviorSubject<T> | Subject<T>;
  resetSource?: Subject<void>; // TODO: Specify type for resetSource
  hasToolbar?: boolean;
  hasActions?: boolean;
  sendMessagePlaceholder?: string;
  codeMirrorParams?: {
    lineSeparator: string;
    wrapLines: boolean;
  };
  autoScrollEnabled?: boolean;
  onAutoScrollChanged?: (enabled: boolean) => void;
  timestampsActive?: boolean;
  onTimestampsChanged?: (enabled: boolean) => void;
};

export type SerialMonitorToolbarProps = Pick<
  SerialMonitorLogicResult,
  'deviceName' | 'portName' | 'onPlayPause' | 'status' | 'disabled'
> & {
  clearLog: VoidFunction;
} & {
  onToggleTimestamps: ReturnType<UseMonitorCodeMirror>['toggleTimestamps'];
  timestampsActive: ReturnType<UseMonitorCodeMirror>['timestampsActive'];
  onFileExport: ReturnType<UseMonitorCodeMirror>['exportFile'];
  onToggleSearchPanel: ReturnType<UseMonitorCodeMirror>['toggleSearchPanel'];
  searchBtnRef: ReturnType<UseMonitorCodeMirror>['searchBtnRef'];
};

export type SerialMonitorContentsProps = Pick<
  SerialMonitorLogicResult,
  'status'
> &
  Pick<
    ReturnType<UseMonitorCodeMirror>,
    'lastLineIsVisible' | 'scrollToBottom' | 'viewInstance'
  > & {
    classes?: {
      content?: string;
      wrapper?: string;
      viewNewDataButton?: string;
    };
    codeMirrorRef: ReturnType<UseMonitorCodeMirror>['rootRef'];
  };

export type SerialMonitorActionsProps = Pick<
  SerialMonitorLogicResult,
  | 'baudRates'
  | 'selectedBaudRate'
  | 'onBaudRateSelected'
  | 'disabled'
  | 'status'
  | 'onMessageSend'
> &
  Pick<ReturnType<UseMonitorCodeMirror>, 'scrollToBottom'> & {
    classes?: {
      wrapper?: string;
      selector?: { wrapper?: string; menu?: string; menuPopover?: string };
      input?: { wrapper?: string; input?: string; button?: string };
    };
    placeholder?: string;
  };

export const LINE_ENDINGS = [
  'newLine',
  'carriageReturn',
  'bothNLandCR',
  'noLineEnding',
] as const;
