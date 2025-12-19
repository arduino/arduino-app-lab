import { Config } from '@cloud-editor-mono/common';
import { useCallback } from 'react';
import { useEvent } from 'react-use';

import { SerialMonitorWindowUpdates } from '../../main/hooks/serialMonitorWindow';
import { type UpdateStatusWithInput } from './useStatus';

function useOnIsUploadingUpdate(sendStatusInput: UpdateStatusWithInput): void {
  const onIsUploadingUpdate = useCallback(
    (event: MessageEvent) => {
      if (
        event.origin === Config.SERIAL_MONITOR_PARENT_ORIGIN &&
        event.data?.type === SerialMonitorWindowUpdates.isUploadingUpdate
      ) {
        if (event.data.payload === true) {
          sendStatusInput('UPLOAD_STARTED');
        } else if (event.data.payload === false) {
          sendStatusInput('UPLOAD_FINISHED');
        }
      }
    },
    [sendStatusInput],
  );

  useEvent('message', onIsUploadingUpdate);
}

export default useOnIsUploadingUpdate;
