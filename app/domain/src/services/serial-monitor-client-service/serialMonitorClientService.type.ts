import { SerialMonitorObservableMessage } from '@cloud-editor-mono/board-communication-tools';
export type { BaudRate } from '@cloud-editor-mono/board-communication-tools';
export {
  BAUD_RATES_VALUES,
  DEFAULT_BAUD_RATE,
  isBaudRate,
} from '@cloud-editor-mono/board-communication-tools';
import { Subject } from 'rxjs';

export type SerialMonitorSubject = Subject<SerialMonitorObservableMessage>;
export type SerialMonitorClearEventsSubject = Subject<void>;
