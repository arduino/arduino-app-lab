export enum DownloadQuotaItemStatus {
  Sent = 'sent',
  Pending = 'pending',
  Success = 'success',
  Error = 'error',
}

interface DaemonDownloadQuotaItem {
  requestBatchId: string;
  status: DownloadQuotaItemStatus;
}

export type DaemonDownloadQuota = DaemonDownloadQuotaItem[];

export interface SendDownloadMsgPayload {
  toolName: string;
  toolVersion: string;
  packageName: string;
  replacementStrategy?: string;
}

export type DefaultToolDownload = SendDownloadMsgPayload;

export enum AgentDownloadStatus {
  Success = 'Success',
  Pending = 'Pending',
}

export interface DownloadStatusResponse {
  status: AgentDownloadStatus;
  message: string;
}

export interface DownloadToolPayload {
  name: string;
  version: string;
  packager: string;
}

export function isCompleteDownloadToolPayload(
  tool: any,
): tool is DownloadToolPayload {
  return Boolean(tool.name && tool.version && tool.packager);
}
