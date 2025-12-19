import {
  resetDaemonState,
  resetSocketHandlers,
} from '@cloud-editor-mono/create-agent-client-ts';
import {
  clearCompilationStream,
  resetCreateApiState,
  resetIsUnauthorizedEvents,
  resetNotificationState,
  resetPreferencesState,
  resetSerialMonitorObervables as resetSerialMonitorObservables,
} from '@cloud-editor-mono/domain';
import { resetWebSerialState } from '@cloud-editor-mono/web-board-communication';
import { resetChannel } from '@cloud-editor-mono/web-board-communication';

import { clearCompileDataWasStored } from '../../../src/cloud-editor/features/main/hooks/utils';
import { resetPortSelectionSubjects } from '../../../src/cloud-editor/features/main/portSelection.reactive';

export function resetModuleScopedState(): void {
  // ** Serial comms
  resetSocketHandlers();
  resetDaemonState();
  resetChannel();
  resetWebSerialState();
  resetSerialMonitorObservables();

  // ** Compilation
  clearCompilationStream();
  clearCompileDataWasStored();

  // ** Auth
  resetIsUnauthorizedEvents();

  // ** Main
  resetPortSelectionSubjects();
  resetPreferencesState();
  resetNotificationState();
  resetCreateApiState();
}
