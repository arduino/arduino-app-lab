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
  receiveContentUpdate: (content: string, isSentByUser: boolean) => void,
  receiveContentReset: () => void,
  resetSource?: Subject<void>, // Optional reset source for resetting content
) => void;

//TODO: Add subject type
export type SerialMonitorLogic = (subject?: any) => {
  deviceName?: string;
  portName?: string;
  contentUpdateLogic: ContentUpdateLogic;
  baudRates: number[];
  selectedBaudRate: ReturnType<SerialMonitorLogic>['baudRates'][number];
  onBaudRateSelected: (
    baudRate: ReturnType<SerialMonitorLogic>['baudRates'][number],
  ) => void;
  onPlayPause: () => void;
  onMessageSend: (message: string) => void;
  clearMessages: VoidFunction;
  status: SerialMonitorStatus;
  disabled: boolean;
};

export type SerialMonitorProps = {
  serialMonitorLogic: SerialMonitorLogic;
  classes?: {
    wrapper?: string;
    contents?: { wrapper?: string };
    actions?: SerialMonitorActionsProps['classes'];
  };
  logSource?: BehaviorSubject<any> | Subject<any>;
  resetSource?: Subject<void>; // TODO: Specify type for resetSource
  hasToolbar?: boolean;
  hasActions?: boolean;
  sendMessagePlaceholder?: string;
  codeMirrorParams?: {
    lineSeparator: string;
    wrapLines: boolean;
  };
};

export type SerialMonitorToolbarProps = Pick<
  ReturnType<SerialMonitorLogic>,
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
  ReturnType<SerialMonitorLogic>,
  'status'
> &
  Pick<
    ReturnType<UseMonitorCodeMirror>,
    'lastLineIsVisible' | 'scrollToBottom'
  > & {
    classes?: { wrapper?: string };
    codeMirrorRef: ReturnType<UseMonitorCodeMirror>['rootRef'];
  };

export type SerialMonitorActionsProps = Pick<
  ReturnType<SerialMonitorLogic>,
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
      selector?: { wrapper?: string; menu?: string };
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
