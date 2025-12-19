import {
  getExtAndData,
  UPLOAD_TIMEOUT,
  uploadCompletePredicate,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { ArduinoBuilderBoardscomputev3Tool_BuilderApi } from '@cloud-editor-mono/infrastructure';
import { uniqueId } from 'lodash';

import { daemonState, setAgentDaemonState } from '../daemon/state';
import { listenForAgentStateCondition } from '../daemon/state.reactive';
import { AgentDaemonStateKeys } from '../daemon/state.type';
import {
  downloadTools,
  downloadToolV2,
  mapToolDataToDownloadMsgPayload,
} from '../downloads/downloads';
import { isCompleteDownloadToolPayload } from '../downloads/downloads.type';
import { DEFAULT_UPLOAD_EXTENSION } from '../utils';
import { createHttpUploadPayload, httpUpload } from './http';
import { UploadToAgentPortPayload } from './upload.type';

async function downloadToolsRequiredForUpload(
  tools: ArduinoBuilderBoardscomputev3Tool_BuilderApi[],
): Promise<void> {
  const {
    config: { useV2 },
  } = daemonState;

  if (useV2) {
    const downloads = tools.map((tool) => {
      return downloadToolV2(tool);
    });

    await Promise.all(downloads); // TODO check if resolution of this represents completion of download
  } else {
    const downloads = tools
      .filter(isCompleteDownloadToolPayload)
      .map(mapToolDataToDownloadMsgPayload);

    await downloadTools(downloads);
  }
}

export async function uploadToAgentPort(
  payload: UploadToAgentPortPayload,
): Promise<UploadStatus> {
  setAgentDaemonState({
    [AgentDaemonStateKeys.UploadStatus]: UploadStatus.NONE,
  });
  const {
    computeUploadInfo: { signature },
  } = payload;

  if (!signature) {
    throw Error(
      'Could not perform upload, compute result is missing a signature.',
    );
  }

  const { computeUploadInfo, compileData } = payload;
  const { commandline } = computeUploadInfo;

  if (!commandline) return UploadStatus.ERROR;

  const [ext, data] = getExtAndData(commandline, compileData);
  if (typeof data !== 'string') {
    return Promise.reject('invalid upload payload data');
  }

  const {
    computeUploadInfo: { tools },
  } = payload;

  if (tools && Array.isArray(tools) && tools.length > 0) {
    await downloadToolsRequiredForUpload(tools);
  }

  let extToUse = DEFAULT_UPLOAD_EXTENSION;
  if (ext && data) {
    extToUse = ext;
  }

  const {
    fqbn: board,
    port,
    sketchName,
    compileData: { files: compileDataFiles },
    computeUploadInfo: { files: computeFiles, options },
  } = payload;

  const httpUploadPayload = createHttpUploadPayload(
    board,
    port,
    sketchName,
    extToUse,
    data,
    commandline,
    signature,
    options,
    compileDataFiles,
    computeFiles,
  );

  const uploadCompletePromise = listenForAgentStateCondition(
    AgentDaemonStateKeys.UploadStatus,
    uploadCompletePredicate(AgentDaemonStateKeys.UploadStatus),
    UploadStatus.ERROR,
    UPLOAD_TIMEOUT,
  );

  try {
    await httpUpload(httpUploadPayload);
  } catch (error) {
    console.error(error);
    return UploadStatus.ERROR;
  }

  // here we add an item to the quota, this will be removed when any
  // an upload msg is received that indicates the upload has ended
  const quotaItemId = uniqueId();
  setAgentDaemonState({
    [AgentDaemonStateKeys.UploadQuota]: [
      ...daemonState[AgentDaemonStateKeys.UploadQuota],
      { timestamp: Date.now(), id: quotaItemId },
    ],
  });

  const uploadCompleteResult = await uploadCompletePromise;

  setAgentDaemonState({
    [AgentDaemonStateKeys.UploadQuota]: daemonState[
      AgentDaemonStateKeys.UploadQuota
    ].filter((item) => item.id !== quotaItemId),
  });

  return uploadCompleteResult || UploadStatus.ERROR;
}
