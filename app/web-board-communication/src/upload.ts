import './web-serial-dialog.scss';

import {
  DEFAULT_UPLOAD_EXTENSION,
  getExtAndData,
  UPLOAD_TIMEOUT,
  uploadCompletePredicate,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { listenForStateCondition } from '@cloud-editor-mono/common';

import { getChannel } from './channel';
import { messages } from './messages';
import { webSerialState } from './state';
import { getStateSubject } from './state.reactive';
import { WebSerialStateKeys } from './state.type';
import {
  UploadToWebSerialPortPayload,
  WebSerialUploadPayload,
} from './upload.type';

export async function uploadToWebSerialPort(
  payload: UploadToWebSerialPortPayload,
): Promise<UploadStatus> {
  const { computeUploadInfo, compileData } = payload;
  const { commandline } = computeUploadInfo;

  if (!commandline) return UploadStatus.ERROR;

  const [ext, data] = getExtAndData(commandline, compileData);
  if (typeof data !== 'string') {
    return Promise.reject('invalid upload payload data');
  }

  let extToUse = DEFAULT_UPLOAD_EXTENSION;
  if (ext && data) {
    extToUse = ext;
  }

  const webSerialPayload = createWebSerialPayload(payload, extToUse);

  const uploadCompletePromise = listenForStateCondition(
    webSerialState,
    WebSerialStateKeys.UploadStatus,
    uploadCompletePredicate(WebSerialStateKeys.UploadStatus),
    UploadStatus.ERROR,
    getStateSubject(),
    UPLOAD_TIMEOUT,
  );

  const channel = getChannel();

  await channel.upload({
    ...webSerialPayload,
    commandline,
    data,
    dialogCustomizations: [
      // the first two items are apparently duplicated, but the chromeos uploader
      // uses items 0 or 1 from this array in slightly different scenarios,
      // so it's better to provide both
      {
        questionText: messages.dialogQuestion.defaultMessage,
        positiveButtonText: messages.dialogPositiveButton.defaultMessage,
        titleText: `${messages.dialogTitle.defaultMessage}.`,
        additionalWarning: messages.boardResetHint.defaultMessage,
      },
      {
        questionText: messages.dialogQuestion.defaultMessage,
        positiveButtonText: messages.dialogPositiveButton.defaultMessage,
        titleText: `${messages.dialogTitle.defaultMessage}.`,
        additionalWarning: messages.boardResetHint.defaultMessage,
      },
      // item 2 is used in UF2 based boards (e.g. Nano RP2040)
      {
        questionText: messages.uf2DialogQuestion.defaultMessage,
        positiveButtonText: messages.uf2DialogPositiveButton.defaultMessage,
        titleText: `${messages.uf2DialogTitle.defaultMessage}.`,
      },
    ],
  });

  const uploadCompleteResult = await uploadCompletePromise;

  return uploadCompleteResult || UploadStatus.ERROR;
}

export function createWebSerialPayload(
  payload: UploadToWebSerialPortPayload,
  extToUse: string,
): WebSerialUploadPayload {
  const extrafiles = [
    ...(payload.computeUploadInfo.files || []),
    ...(payload.compileData.files || []),
  ];

  return {
    board: payload.fqbn,
    port: payload.port,
    filename: `${payload.sketchName}.${extToUse}`,
    extrafiles,
    vid: Number(payload.port.split('/')[0]),
    pid: Number(payload.port.split('/')[1]),
  };
}
