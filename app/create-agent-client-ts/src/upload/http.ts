import { Config } from '@cloud-editor-mono/common';
import {
  ArduinoBuilderBoardscomputev3_BuilderApi,
  CompileSketch_Response,
  httpPostRaw,
} from '@cloud-editor-mono/infrastructure';

import { getAgentUrl } from '../daemon/agent';
import { HttpUploadPayload } from './upload.type';

export function createHttpUploadPayload(
  board: string,
  port: string,
  sketchName: string,
  ext: string,
  data: string,
  commandline: string,
  signature: string,
  options: ArduinoBuilderBoardscomputev3_BuilderApi['options'],
  compileDataFiles: CompileSketch_Response['files'],
  computeFiles: ArduinoBuilderBoardscomputev3_BuilderApi['files'],
): HttpUploadPayload {
  const extrafiles = [...(computeFiles || []), ...(compileDataFiles || [])];

  const payload = {
    board,
    port,
    filename: `${sketchName}.${ext}`,
    hex: data,
    signature,
    commandline,
    extra: options,
    extrafiles,
  };

  return payload;
}

export function httpUpload(
  payload: HttpUploadPayload,
): ReturnType<typeof httpPostRaw> {
  const agentUrl = getAgentUrl();

  return httpPostRaw(
    agentUrl,
    Config.AGENT_UPLOAD_ENDPOINT,
    JSON.stringify(payload),
    undefined,
    undefined,
    (error) => {
      throw error;
    },
  );
}
