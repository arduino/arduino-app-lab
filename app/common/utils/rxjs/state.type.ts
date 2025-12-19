import {
  SerialMonitorsDisconnections,
  SerialMonitorsMsgStream,
  UploadConcatResponseStream,
  UploadResponseStream,
} from '@cloud-editor-mono/board-communication-tools';
import { StateSubject } from '@cloud-editor-mono/common';

export interface State<T> {
  serialMonitorsMsgStream$?: SerialMonitorsMsgStream;
  serialMonitorsDisconnections$?: SerialMonitorsDisconnections;
  stateChangeSubject$?: StateSubject<T>;
  uploadConcatResponseStream$?: UploadConcatResponseStream;
  uploadResponseStream$?: UploadResponseStream;
}
