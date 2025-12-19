import { Uploader as Channel } from '@bcmi-labs/arduino-chromeos-uploader';
import { BoardDescriptor } from '@bcmi-labs/arduino-chromeos-uploader/dist/types/types';
import {
  SerialMonitor,
  serialMonitorsDisconnectionsNext,
  serialMonitorsMsgStreamNext,
  uploadResponseStreamNext,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { Config } from '@cloud-editor-mono/common';

import { mapPortsListMessage } from './mapper';
import { setWebSerialState, webSerialState } from './state';
import { WebSerialStateKeys } from './state.type';
import { devicesListAreEquals } from './utils';

let channel: Channel | null = null;

export function resetChannel(): void {
  channel = null;
}

class Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, data?: any[]): void {
    if (this.shouldLogUploadMessage()) {
      this.uploadLog(message);
    }
    console.log(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, data?: any[]): void {
    if (this.shouldLogUploadMessage()) {
      this.uploadLog(message);
    }
    console.log(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, data?: any[]): void {
    console.warn(message, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, data?: any[]): void {
    console.error(message, data);
  }

  private shouldLogUploadMessage(): boolean {
    console.log(webSerialState[WebSerialStateKeys.UploadStatus]);
    return (
      webSerialState[WebSerialStateKeys.UploadStatus] === UploadStatus.IN_PROG
    );
  }

  private uploadLog(message: string): void {
    // ignore string checks
    if (!message.toLowerCase().includes('checked response')) {
      uploadResponseStreamNext(setWebSerialState, webSerialState, message);
    }
  }
}

function instantiateChannel(): Channel {
  channel = new Channel({
    whiteListedOrigins: [Config.APP_ORIGIN, Config.WEB_IDE_URL],
    logger: new Logger(),
  });

  channel.onMessage(messageEventHandler);
  return channel;
}

export function getChannel(): Channel {
  if (channel) return channel;

  channel = instantiateChannel();

  return channel;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function messageEventHandler(message: any): void {
  if (message.portCloseStatus === 'success') {
    const { [WebSerialStateKeys.SerialMonitors]: serialMonitors } =
      webSerialState;
    const port = serialMonitors[0]?.port; // find a better way to get the port

    const serialMonitorIndex = serialMonitors.findIndex(
      (sm) => sm.port === port,
    );
    const serialMonitorExists = serialMonitorIndex !== -1;
    let newSerialMonitors: SerialMonitor[];

    if (serialMonitorExists) {
      serialMonitorsDisconnectionsNext(setWebSerialState, webSerialState, port);

      newSerialMonitors = serialMonitors.filter((sm) => sm.port !== port);
    } else {
      newSerialMonitors = serialMonitors;
    }

    setWebSerialState({
      [WebSerialStateKeys.SerialMonitors]: newSerialMonitors,
    });
  }

  if (message.serialData) {
    const { [WebSerialStateKeys.SerialMonitors]: serialMonitors } =
      webSerialState;
    const port = serialMonitors[0]?.port; // find a better way to get the port

    serialMonitorsMsgStreamNext(setWebSerialState, webSerialState, {
      port,
      data: message.serialData,
    });
  }

  if (message.ports && Array.isArray(message.ports)) {
    const ports = message.ports.filter(isBoardsDescriptor);
    const lastDevices = webSerialState[WebSerialStateKeys.Ports];
    const mappedPorts = mapPortsListMessage(ports);
    if (!devicesListAreEquals(lastDevices, mappedPorts)) {
      setWebSerialState({
        [WebSerialStateKeys.Ports]: mappedPorts,
      });
    }
  }

  if (message.supportedBoards) {
    setWebSerialState({
      [WebSerialStateKeys.SupportedFqbns]: Object.keys(message.supportedBoards),
    });
  }

  if (message.uploadStatus) {
    uploadResponseStreamNext(
      setWebSerialState,
      webSerialState,
      message.message,
    );

    switch (message.uploadStatus) {
      case 'message':
        setWebSerialState({
          [WebSerialStateKeys.UploadStatus]: UploadStatus.IN_PROG,
        });
        break;
      case 'error':
        setWebSerialState({
          [WebSerialStateKeys.UploadStatus]: UploadStatus.ERROR,
        });
        break;
      case 'success':
        setWebSerialState({
          [WebSerialStateKeys.UploadStatus]: UploadStatus.DONE,
        });
        break;

      default:
        setWebSerialState({
          [WebSerialStateKeys.UploadStatus]: UploadStatus.NONE,
        });
    }
  }

  if (message.err) {
    setWebSerialState({
      uploadStatus: UploadStatus.ERROR,
    });
  }
}
function isBoardsDescriptor(port: any): port is BoardDescriptor {
  return (
    port.name !== undefined &&
    port.vendorId !== undefined &&
    port.productId !== undefined &&
    port.fqbn !== undefined &&
    port.isOpen !== undefined
  );
}
