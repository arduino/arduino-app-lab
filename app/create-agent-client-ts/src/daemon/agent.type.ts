import { httpGetRaw } from '@cloud-editor-mono/infrastructure';

export interface AgentInfoResponse {
  endpointUrl?: string;
  status?: number;
  http?: string;
  https?: string;
  ws?: string;
  wss?: string;
  updateUrl?: string;
  version?: string;
  os?: string;
}

export interface AgentUnsecureProtocolInfo {
  http: string;
  ws: string;
}

export interface AgentSecureProtocolInfo {
  https: string;
  wss: string;
}

export interface AgentOSInfo {
  os: string;
}

export type AgentInfoFetch = () => ReturnType<typeof httpGetRaw>;

export enum AgentCommands {
  List = 'list',
  Download = 'downloadTool',
}

export enum DefaultToolVersions {
  Latest = 'latest',
}

export enum DefaultToolNames {
  Arduino = 'arduino',
}

// List command
export interface AgentPort {
  isOpen: boolean;
  portName: string;
  productId: string;
  serialNumber: string;
  vendorId: string;
  networkPort?: boolean;
  isPrimary?: boolean;
  version?: string;
  baud?: number;
  bufferAlgorithm?: string;
  deviceClass?: string;
}

export interface AgentNetworkPort {
  [key: string]: any;
}

export interface AgentListResponse {
  ports: AgentPort[];
  areNetworkPorts: AgentNetworkPort[];
}

// Type guards

export const agentUnsecureProtocolInfoIsComplete = (
  info: AgentInfoResponse,
): info is AgentUnsecureProtocolInfo => {
  return Boolean(info.http && info.ws);
};

export const agentSecureProtocolInfoIsComplete = (
  info: AgentInfoResponse,
): info is AgentSecureProtocolInfo => {
  return Boolean(info.https && info.wss);
};

export const agentOSInfoIsComplete = (
  info: AgentInfoResponse,
): info is AgentOSInfo => {
  return Boolean(info.os);
};
