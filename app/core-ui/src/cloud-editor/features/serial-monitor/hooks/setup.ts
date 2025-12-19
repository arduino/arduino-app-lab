import { Config } from '@cloud-editor-mono/common';
import {
  AgentDaemonState,
  connectToAgentWebSocket,
  getAgentWsConnectionAddress,
  setAgentDaemonState,
  waitForWebSocketConnection,
} from '@cloud-editor-mono/create-agent-client-ts';
import {
  createOnIdReceived,
  isChromeOs,
  sendIdRequest,
} from '@cloud-editor-mono/domain';
import {
  setWebSerialState,
  WebSerialState,
} from '@cloud-editor-mono/web-board-communication';
import { useCallback, useEffect, useRef } from 'react';
import { useEvent } from 'react-use';

import { SerialMonitorWindowUpdates } from '../../main/hooks/serialMonitorWindow';
import { Device, SerialMonitorConfig } from '../serialMonitor.type';
import { sendSerialMonitorMsg } from '../utils';
import { type UpdateStatusWithInput } from './useStatus';

function sendConfigRequest(sender: Window, target: string): void {
  sendSerialMonitorMsg(
    sender,
    target,
    SerialMonitorWindowUpdates.serialMonitorConfigRequest,
  );
}

function sendUnloadNotification(sender: Window, target: string): void {
  sendSerialMonitorMsg(
    sender,
    target,
    SerialMonitorWindowUpdates.serialMonitorUnload,
  );
}

function sendActiveNotification(sender: Window, target: string): void {
  sendSerialMonitorMsg(
    sender,
    target,
    SerialMonitorWindowUpdates.serialMonitorActive,
  );
}

function sendInactiveNotification(sender: Window, target: string): void {
  sendSerialMonitorMsg(
    sender,
    target,
    SerialMonitorWindowUpdates.serialMonitorInactive,
  );
}

function useSetupSerialMonitor(
  setDeviceName: (deviceName: string) => void,
  setPortName: (portName: string) => void,
  setDevices: (devices: Device[]) => void,
  sendEvent: UpdateStatusWithInput,
): void {
  const postMsgTarget = Config.SERIAL_MONITOR_PARENT_ORIGIN;

  const configRequestSent = useRef(false);

  useEvent('message', createOnIdReceived(window, postMsgTarget));

  const onConfigReceived = useCallback(
    async (
      event: MessageEvent<{
        type: SerialMonitorWindowUpdates;
        payload: SerialMonitorConfig;
      }>,
    ): Promise<void> => {
      if (
        event.origin === postMsgTarget &&
        event.data?.type === SerialMonitorWindowUpdates.serialMonitorConfig
      ) {
        const config = event.data.payload;
        setDeviceName(config.initialSelectedDeviceName);
        setPortName(config.initialSelectedPort);
        setDevices(config.initialDevices);

        if (!isChromeOs) {
          setAgentDaemonState(config.state as AgentDaemonState);
          connectToAgentWebSocket(getAgentWsConnectionAddress());
          const connected = await waitForWebSocketConnection();
          if (!connected) {
            throw new Error(
              'Failed to connect to serial monitor, no websocket connection available',
            );
          }
        } else {
          setWebSerialState(config.state as WebSerialState);
        }

        sendEvent('CONNECTED');
      }
    },
    [postMsgTarget, sendEvent, setDeviceName, setDevices, setPortName],
  );

  useEvent('message', onConfigReceived);

  const unloadHandler = useCallback((): void => {
    sendUnloadNotification(window, postMsgTarget);
  }, [postMsgTarget]);

  useEvent('beforeunload', unloadHandler);

  const sendActiveHandler = useCallback((): void => {
    sendActiveNotification(window, postMsgTarget);
  }, [postMsgTarget]);

  useEvent(SerialMonitorWindowUpdates.serialMonitorActive, sendActiveHandler);

  const sendInactiveHandler = useCallback((): void => {
    sendInactiveNotification(window, postMsgTarget);
  }, [postMsgTarget]);

  useEvent(
    SerialMonitorWindowUpdates.serialMonitorInactive,
    sendInactiveHandler,
  );

  useEffect(() => {
    if (!configRequestSent.current) {
      sendIdRequest(window, postMsgTarget);

      sendConfigRequest(window, postMsgTarget);
      configRequestSent.current = true;
    }
  }, [
    setDeviceName,
    setDevices,
    setPortName,
    sendEvent,
    unloadHandler,
    postMsgTarget,
  ]);
}

export default useSetupSerialMonitor;
