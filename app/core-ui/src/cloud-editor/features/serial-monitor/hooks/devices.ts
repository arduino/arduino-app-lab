import { Config } from '@cloud-editor-mono/common';
import { SerialMonitorStatus } from '@cloud-editor-mono/ui-components';
import { useCallback, useEffect } from 'react';
import { useEvent, usePrevious } from 'react-use';

import { SerialMonitorWindowUpdates } from '../../main/hooks/serialMonitorWindow';
import { Device } from '../serialMonitor.type';
import { type UpdateStatusWithInput } from './useStatus';

function isSameDevice(
  portName: string,
  deviceName: string,
): (device: Device) => boolean {
  return (device: Device) =>
    device.portName === portName && device.name === deviceName;
}

function selectedDeviceIsAvailableAgain(
  portName: string,
  deviceName: string,
  previousDevices?: Device[],
  devices?: Device[],
): boolean {
  return Boolean(
    previousDevices &&
      devices &&
      !previousDevices.some(isSameDevice(portName, deviceName)) &&
      devices.some(isSameDevice(portName, deviceName)),
  );
}

function useOnDevicesUpdate(
  portName: string | undefined,
  deviceName: string | undefined,
  baudRate: number,
  devices: Device[],
  setDevices: (devices: Device[]) => void,
  status: SerialMonitorStatus,
  sendEvent: UpdateStatusWithInput,
): void {
  const onDevicesUpdate = useCallback(
    (event: MessageEvent) => {
      if (
        event.origin === Config.SERIAL_MONITOR_PARENT_ORIGIN &&
        event.data?.type === SerialMonitorWindowUpdates.devicesUpdate
      ) {
        setDevices(event.data.payload);
      }
    },
    [setDevices],
  );

  useEvent('message', onDevicesUpdate);

  // Device info changes side effects
  const previousDevices = usePrevious(devices);
  useEffect(() => {
    const boardIsSelected = portName && deviceName;
    if (boardIsSelected) {
      // When the serial monitor is paused, we don't have disconnection events
      // from the serial monitor observable stream, se we rely on devices info
      // if the selected device becomes not available anymore, we update the serial monitor
      // status accordingly.
      if (
        status === SerialMonitorStatus.Paused &&
        !devices?.some(isSameDevice(portName, deviceName))
      ) {
        sendEvent('NOT_REACHABLE');
      }

      // When a selected disconnected port is connected again
      if (
        selectedDeviceIsAvailableAgain(
          portName,
          deviceName,
          previousDevices,
          devices,
        )
      ) {
        sendEvent('RESTART');
      }
    }
  }, [
    previousDevices,
    baudRate,
    deviceName,
    devices,
    portName,
    status,
    sendEvent,
    setDevices,
  ]);
}

export default useOnDevicesUpdate;
