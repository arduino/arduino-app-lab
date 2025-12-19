import { Config } from '@cloud-editor-mono/common';
import {
  AgentDaemonState,
  closeAgentSerialMonitor$,
  exportAgentDaemonState,
} from '@cloud-editor-mono/create-agent-client-ts';
import { getNewMonitorWindow, isChromeOs } from '@cloud-editor-mono/domain';
import {
  closeWebSerialMonitor$,
  exportWebSerialState,
  WebSerialState,
} from '@cloud-editor-mono/web-board-communication';
import { useCallback, useContext, useEffect } from 'react';
import { useEvent, useGetSet } from 'react-use';

import {
  MappedPorts,
  SerialCommunicationContext,
} from '../../../../common/providers/serial-communication/serialCommunicationContext';
import { MONITOR_PATH } from '../../../../routing/Router';
import { UseSerialMonitorWindow } from '../main.type';

const WINDOW_WIDTH = 720;
const WINDOW_HEIGHT = 630;

export enum SerialMonitorWindowUpdates {
  serialMonitorConfigRequest = 'serialMonitorConfigRequest',
  serialMonitorConfig = 'serialMonitorConfig',
  devicesUpdate = 'devicesUpdate',
  serialMonitorActive = 'serialMonitorActive',
  serialMonitorInactive = 'serialMonitorInactive',
  isUploadingUpdate = 'isUploading',
  serialMonitorUnload = 'serialMonitorUnload',
}

type SerialMonitorWindowState = {
  isClosing: boolean;
  window: Window | null;
  port: string | null;
  deviceName: string | null;
  availablePorts: MappedPorts;
};

const state: SerialMonitorWindowState = {
  isClosing: false,
  window: null,
  port: null,
  deviceName: null,
  availablePorts: [],
};

const handleWindowUnload = (): void => {
  state.window?.close();
  state.window = null;
};

// message senders
function sendConfig(
  receiver: Window,
  deviceName: string,
  portName: string,
  initialPorts: MappedPorts,
  exportState: () => AgentDaemonState | WebSerialState,
): void {
  receiver.postMessage(
    {
      type: SerialMonitorWindowUpdates.serialMonitorConfig,
      payload: {
        initialSelectedDeviceName: deviceName,
        initialSelectedPort: portName,
        state: exportState(),
        initialDevices: initialPorts.map(({ portName, name }) => ({
          portName,
          name,
        })),
      },
    },
    Config.NEW_WINDOW_ORIGIN,
  );
}

function sendDevicesUpdate(receiver: Window, ports: MappedPorts): void {
  receiver.postMessage(
    {
      type: SerialMonitorWindowUpdates.devicesUpdate,
      payload: ports.map(({ portName, name }) => ({
        portName,
        name,
      })),
    },
    Config.NEW_WINDOW_ORIGIN,
  );
}

// message handlers
function isMessageType(
  event: MessageEvent,
  type: SerialMonitorWindowUpdates,
): boolean {
  if (event.origin !== Config.NEW_WINDOW_ORIGIN) return false;
  return event.data?.type === type;
}

const handleConfigRequest = (event: MessageEvent): void => {
  if (
    isMessageType(event, SerialMonitorWindowUpdates.serialMonitorConfigRequest)
  ) {
    if (
      state.window &&
      state.deviceName &&
      state.port &&
      state.availablePorts
    ) {
      sendConfig(
        state.window,
        state.deviceName,
        state.port,
        state.availablePorts,
        isChromeOs ? exportWebSerialState : exportAgentDaemonState,
      );
    }
  }
};

function useSetupSerialMonitorEventHandlers(
  getIsActive: () => boolean,
  setIsActive: (isActive: boolean) => void,
): void {
  const handleUnloadNotification = useCallback(
    (event: MessageEvent) => {
      if (
        isMessageType(event, SerialMonitorWindowUpdates.serialMonitorUnload)
      ) {
        if (state.port && getIsActive()) {
          state.isClosing = true;

          const closeSerialMonitor$ = isChromeOs
            ? closeWebSerialMonitor$
            : closeAgentSerialMonitor$;

          closeSerialMonitor$(state.port).subscribe(() => {
            state.isClosing = false;
            setIsActive(false);
          });
        }
        state.window = null;
      }
    },
    [getIsActive, setIsActive],
  );

  const handleActiveNotification = useCallback(
    (event: MessageEvent) => {
      if (
        isMessageType(event, SerialMonitorWindowUpdates.serialMonitorActive)
      ) {
        setIsActive(true);
      }
    },
    [setIsActive],
  );

  const handleInActiveNotification = useCallback(
    (event: MessageEvent) => {
      if (
        isMessageType(event, SerialMonitorWindowUpdates.serialMonitorInactive)
      ) {
        setIsActive(false);
      }
    },
    [setIsActive],
  );

  useEvent('beforeunload', handleWindowUnload);
  useEvent('message', handleConfigRequest);
  useEvent('message', handleUnloadNotification);
  useEvent('message', handleActiveNotification);
  useEvent('message', handleInActiveNotification);
}

export const useSerialMonitorWindow: UseSerialMonitorWindow = (
  initialSelectedDeviceName?: string,
  initialSelectedPort?: string,
  isUploading = false,
) => {
  if (initialSelectedDeviceName) {
    state.deviceName = initialSelectedDeviceName;
  }
  if (initialSelectedPort) {
    state.port = initialSelectedPort;
  }

  const { mappedPorts: availablePorts } = useContext(
    SerialCommunicationContext,
  );

  if (availablePorts) {
    state.availablePorts = availablePorts;
  }

  const [getIsActive, setIsActive] = useGetSet(false);

  useSetupSerialMonitorEventHandlers(getIsActive, setIsActive);

  const open = useCallback(
    (width = WINDOW_WIDTH, height = WINDOW_HEIGHT) => {
      if (!initialSelectedPort) {
        throw new Error('No port selected');
      }

      if (!initialSelectedDeviceName) {
        throw new Error("Can't retrieve device name");
      }

      if (!availablePorts || availablePorts?.length === 0) {
        throw new Error('No ports are available');
      }

      if (
        !availablePorts
          .map((mappedPort) => mappedPort.portName)
          .includes(initialSelectedPort)
      ) {
        throw new Error('Selected port is not available');
      }

      if (state.isClosing) {
        window.alert('Selected port is currently closing');
        throw new Error('Selected port is currently closing');
      }

      if (state.window && !state.window.closed) {
        state.window.focus();
        return;
      }

      const left = (window.screenX - width) / 2;
      const top = (window.innerHeight - height) / 2;
      const newWindow = getNewMonitorWindow(
        `${Config.NEW_WINDOW_ORIGIN}${
          Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
        }/${MONITOR_PATH}`,
        new Set(),
        `serial_monitor`,
        `width=${width}, 
                height=${height}, 
                top=${top}, 
                left=${left}`,
      );

      if (newWindow) {
        state.window = newWindow;
      } else {
        throw new Error('Could not open new serial monitor window');
      }
    },
    [initialSelectedPort, initialSelectedDeviceName, availablePorts],
  );

  const sendIsUploadingUpdate = useCallback((isUploading: boolean) => {
    if (state.window) {
      state.window.postMessage(
        {
          type: SerialMonitorWindowUpdates.isUploadingUpdate,
          payload: isUploading,
        },
        Config.NEW_WINDOW_ORIGIN,
      );
    }
  }, []);

  useEffect(() => {
    if (state.window && availablePorts) {
      sendDevicesUpdate(state.window, availablePorts);
    }
  }, [availablePorts]);

  useEffect(() => {
    sendIsUploadingUpdate(isUploading);
  }, [sendIsUploadingUpdate, isUploading]);

  return { open, active: getIsActive() };
};
