import {
  SerialMonitorMessage,
  SerialMonitorStatusUpdate,
} from '@cloud-editor-mono/board-communication-tools';

import { AgentInfoResponse, AgentListResponse } from './daemon/agent.type';
import { DownloadStatusResponse } from './downloads/downloads.type';
import { SocketIOMessageCategories } from './socket/socket.type';
import { UploadStatusResponse } from './upload/upload.type';

export function mapAgentInfoResponse(data: any): AgentInfoResponse {
  return {
    endpointUrl: data.url,
    status: data.status,
    http: data.http,
    https: data.https,
    ws: data.ws,
    wss: data.wss,
    updateUrl: data.update_url,
    version: data.version,
    os: data.os,
  };
}

export function mapPortsListMessage(data: any): AgentListResponse {
  const { Ports, Network } = data;

  return {
    ports: Ports.map((port: any) => {
      return {
        baud: port.Baud,
        bufferAlgorithm: port.BufferAlgorithm,
        deviceClass: port.DeviceClass,
        isOpen: port.IsOpen,
        isPrimary: port.IsPrimary,
        portName: port.Name,
        networkPort: port.NetworkPort,
        productId: port.ProductID,
        serialNumber: port.SerialNumber,
        vendorId: port.VendorID,
        version: port.Ver,
      };
    }),
    areNetworkPorts: Network,
  };
}

export function mapDownloadStatusMessage(data: any): DownloadStatusResponse {
  const { DownloadStatus, Msg } = data;
  return {
    status: DownloadStatus,
    message: Msg,
  };
}

export function mapUploadMessage(data: any): UploadStatusResponse {
  const { ProgrammerStatus, Msg, Flash } = data;
  return {
    status: ProgrammerStatus,
    message: Msg,
    flash: Flash,
  };
}

function mapSerialMonitorStatusMessage(data: any): SerialMonitorStatusUpdate {
  const { Cmd, Port, Baud } = data;

  return {
    status: Cmd,
    port: Port,
    baudRate: Baud,
  };
}

function mapSerialMonitorMessage(data: any): SerialMonitorMessage {
  const { P, D } = data;

  return {
    port: P,
    data: D,
  };
}

export const messageMapperDictionary = {
  [SocketIOMessageCategories.ListCommandPortsResponse]: mapPortsListMessage,
  [SocketIOMessageCategories.ListCommandNetworkPortsResponse]:
    mapPortsListMessage,
  [SocketIOMessageCategories.SerialMonitorStatusUpdate]:
    mapSerialMonitorStatusMessage,
  [SocketIOMessageCategories.SerialMonitorMessage]: mapSerialMonitorMessage,
  [SocketIOMessageCategories.DownloadStatusResponse]: mapDownloadStatusMessage,
  [SocketIOMessageCategories.Upload]: mapUploadMessage,
  [SocketIOMessageCategories.Unknown]: (data: any) => data,
};
