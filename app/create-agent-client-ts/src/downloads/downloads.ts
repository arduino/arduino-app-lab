import {
  Config,
  listenForStateCondition,
  StateSubjectValuePair,
} from '@cloud-editor-mono/common';
import {
  httpGetRaw,
  httpHeadRaw,
  httpPostRaw,
} from '@cloud-editor-mono/infrastructure';
import { uniqueId } from 'lodash';

import { getAgentUrl } from '../daemon/agent';
import { daemonState, setAgentDaemonState } from '../daemon/state';
import { getStateSubject } from '../daemon/state.reactive';
import { AgentDaemonState, AgentDaemonStateKeys } from '../daemon/state.type';
import {
  defaultToolDownloads,
  SOCKET_IO_DOWNLOAD_COMMAND_TIMEOUT,
} from '../utils';
import {
  DaemonDownloadQuota,
  DownloadQuotaItemStatus,
  DownloadToolPayload,
  SendDownloadMsgPayload,
} from './downloads.type';

export function mapToolDataToDownloadMsgPayload(
  data: any,
): SendDownloadMsgPayload {
  return {
    toolName: data.name,
    toolVersion: data.version,
    packageName: data.packager,
  };
}

function sendDownloadMsg(
  payload: SendDownloadMsgPayload,
  requestBatchId = uniqueId(),
): void {
  const { socket } = daemonState;
  if (!socket) return;

  const {
    toolName,
    toolVersion,
    packageName,
    replacementStrategy = 'keep',
  } = payload;

  socket.emit(
    'command',
    `downloadtool ${toolName} ${toolVersion} ${packageName} ${replacementStrategy}`,
  );

  const { downloadQuota } = daemonState;
  setAgentDaemonState({
    [AgentDaemonStateKeys.DownloadQuota]: [
      ...downloadQuota,
      {
        requestBatchId,
        status: DownloadQuotaItemStatus.Sent,
      },
    ],
  });
}

export async function downloadTools(
  downloads: SendDownloadMsgPayload[],
): Promise<DaemonDownloadQuota> {
  const { socketConnected } = daemonState;
  if (!socketConnected) return [];

  const requestBatchId = uniqueId();

  const predicate = ([
    _,
    newValue,
  ]: StateSubjectValuePair<AgentDaemonState>): boolean => {
    const { downloadQuota } = newValue;

    if (!downloadQuota) return false;

    return Boolean(
      downloadQuota
        .filter((item) => item.requestBatchId === requestBatchId)
        .every((item) => {
          return (
            item.status === DownloadQuotaItemStatus.Success ||
            item.status === DownloadQuotaItemStatus.Error
          );
        }),
    );
  };

  const downloadQuotaResolvedPromise = listenForStateCondition(
    daemonState,
    AgentDaemonStateKeys.DownloadQuota,
    predicate,
    [],
    getStateSubject(),
    SOCKET_IO_DOWNLOAD_COMMAND_TIMEOUT,
  );

  downloads.forEach((download) => {
    sendDownloadMsg(download, requestBatchId);
  });

  const resolvedDownloadQuota = await downloadQuotaResolvedPromise;

  const filteredQuota = daemonState.downloadQuota.filter(
    (item) => item.requestBatchId !== requestBatchId,
  );
  setAgentDaemonState({ [AgentDaemonStateKeys.DownloadQuota]: filteredQuota });

  return resolvedDownloadQuota;
}

export async function downloadDefaultTools(): Promise<DaemonDownloadQuota> {
  return downloadTools(defaultToolDownloads);
}

export async function V2IsSupported(): Promise<boolean> {
  const agentUrl = getAgentUrl();

  const response = await httpHeadRaw(agentUrl, Config.AGENT_INSTALLED_ENDPOINT);

  if (response?.status !== 200) {
    return false;
  }

  return true;
}

export function downloadToolV2(
  payload: DownloadToolPayload,
): ReturnType<typeof httpPostRaw> {
  const agentUrl = getAgentUrl();

  return httpPostRaw(
    agentUrl,
    Config.AGENT_INSTALLED_ENDPOINT,
    JSON.stringify(payload),
  );
}

export function getInstalledToolsV2(): ReturnType<typeof httpGetRaw> {
  const agentUrl = getAgentUrl();

  return httpGetRaw(agentUrl, Config.AGENT_INSTALLED_ENDPOINT);
}
