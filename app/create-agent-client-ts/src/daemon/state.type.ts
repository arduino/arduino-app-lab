import {
  SerialMonitor,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { State } from '@cloud-editor-mono/common';

import { DaemonDownloadQuota } from '../downloads/downloads.type';
import { AgentInfoResponse, AgentPort } from './agent.type';
import { DaemonConfig } from './daemon.type';

export enum AgentDaemonStateKeys {
  Config = 'config',
  SocketConnected = 'socketConnected',
  DownloadQuota = 'downloadQuota',
  Ports = 'ports',
  NetworkPorts = 'networkPorts',
  AgentInfo = 'agentInfo',
  Socket = 'socket',
  UploadStatus = 'uploadStatus',
  SerialMonitors = 'serialMonitors',
  PortsListQuota = 'portsListQuota',
  UploadQuota = 'uploadQuota',
}

interface DaemonGenericQuotaItem {
  timestamp: number;
  id: string;
}

type DaemonGenericQuota = DaemonGenericQuotaItem[];

export interface AgentDaemonState extends State<AgentDaemonState> {
  [AgentDaemonStateKeys.Config]: DaemonConfig;
  [AgentDaemonStateKeys.SocketConnected]: boolean | null;
  [AgentDaemonStateKeys.DownloadQuota]: DaemonDownloadQuota;
  [AgentDaemonStateKeys.Ports]: AgentPort[];
  [AgentDaemonStateKeys.NetworkPorts]: AgentPort[];
  [AgentDaemonStateKeys.AgentInfo]?: AgentInfoResponse;
  [AgentDaemonStateKeys.Socket]?: SocketIOClient.Socket;
  [AgentDaemonStateKeys.UploadStatus]?: UploadStatus;
  [AgentDaemonStateKeys.SerialMonitors]: SerialMonitor[];
  [AgentDaemonStateKeys.PortsListQuota]: DaemonGenericQuota;
  [AgentDaemonStateKeys.UploadQuota]: DaemonGenericQuota;
  searchedForDaemon: boolean;
  socketEventsAreSet: boolean;
}
