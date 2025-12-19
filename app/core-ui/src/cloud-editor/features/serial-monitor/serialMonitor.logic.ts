import {
  BAUD_RATES_VALUES,
  BaudRate,
  clearEventsNext,
  DEFAULT_BAUD_RATE,
  getSerialMonitor$,
  getSerialMonitorClearEvents$,
  isBaudRate,
  serialMonitorNext,
} from '@cloud-editor-mono/domain';
import {
  ContentUpdateLogic,
  SerialMonitorLogic,
  SerialMonitorStatus,
} from '@cloud-editor-mono/ui-components';
import { useCallback, useEffect, useState } from 'react';
import { useTitle } from 'react-use';

import useOnDevicesUpdate from './hooks/devices';
import useSetupSerialMonitor from './hooks/setup';
import useOnIsUploadingUpdate from './hooks/uploading';
import useStatus from './hooks/useStatus';
import { Device } from './serialMonitor.type';

export function useSerialMonitorLogic(): ReturnType<SerialMonitorLogic> {
  const [deviceName, setDeviceName] = useState<string>();
  const [portName, setPortName] = useState<string>();
  const [baudRate, setBaudRate] = useState<BaudRate>(DEFAULT_BAUD_RATE);
  const [devices, setDevices] = useState<Device[]>([]);

  const { status, enabled, send } = useStatus({
    dependencies: { portName },
  });

  const useContentUpdate: ContentUpdateLogic = (
    receiveContentUpdate,
    receiveContentReset,
  ) => {
    const onReady = (): void => {
      send('STARTED');
    };
    const onUnreachable = (): void => {
      send('NOT_REACHABLE');
    };

    const serialMonitor$ = getSerialMonitor$(
      status,
      portName,
      baudRate,
      onReady,
    );

    useEffect(() => {
      const s = serialMonitor$?.subscribe({
        next(message) {
          receiveContentUpdate(message.value, message.meta === 'sent');
        },
        error(e) {
          console.error(e);
          onUnreachable();
        },
      });
      return () => s?.unsubscribe();
    }, [receiveContentUpdate, serialMonitor$]);

    const serialMonitorClearEvents$ = getSerialMonitorClearEvents$();

    useEffect(() => {
      const s = serialMonitorClearEvents$?.subscribe(receiveContentReset);
      return () => s?.unsubscribe();
    }, [receiveContentReset, serialMonitorClearEvents$]);
  };

  const contentUpdateLogic = useCallback(useContentUpdate, [
    baudRate,
    portName,
    send,
    status,
  ]);

  // Handle initial configuration when serial monitor app is initialized
  useSetupSerialMonitor(setDeviceName, setPortName, setDevices, send);

  // Generic side effects
  useTitle(
    (deviceName || 'Cloud Editor') +
      (status === SerialMonitorStatus.Unavailable ? ' (Unavailable)' : ''),
  );
  // Side effects on external changes
  useOnDevicesUpdate(
    portName,
    deviceName,
    baudRate,
    devices,
    setDevices,
    status,
    send,
  );

  useOnIsUploadingUpdate(send);

  // Callbacks
  const onPlayPause = useCallback(() => {
    if (!portName) {
      throw new Error("Can't play/pause on serial monitor without a port name");
    }

    send('TOGGLE');
  }, [portName, send]);

  const onBaudRateSelected = useCallback(
    (selectedBaudRate: number) => {
      if (!isBaudRate(selectedBaudRate)) {
        throw new Error(
          `Received unexpected value. BaudRate ${selectedBaudRate} is not supported`,
        );
      }
      setBaudRate(selectedBaudRate);
      send('RESTART');
    },
    [send],
  );

  const onMessageSend = useCallback(
    (message: string) => {
      serialMonitorNext(
        { type: 'message', value: message, meta: 'sent' },
        portName,
      );
    },
    [portName],
  );

  return {
    baudRates: BAUD_RATES_VALUES,
    deviceName,
    disabled: !enabled,
    contentUpdateLogic,
    onBaudRateSelected,
    onMessageSend,
    onPlayPause,
    clearMessages: clearEventsNext,
    portName,
    selectedBaudRate: baudRate,
    status,
  };
}
