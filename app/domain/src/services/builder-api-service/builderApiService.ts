import { UNKNOWN_BOARD_FQBN } from '@bcmi-labs/arduino-chromeos-uploader';
import { FileLineScope, trimFileExtension } from '@cloud-editor-mono/common';
import { AgentPort } from '@cloud-editor-mono/create-agent-client-ts';
import {
  addFavoriteLibraryRequest,
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  builderAliveRequest,
  CompilationStreamMessageType,
  CompileSketch_Response,
  Compute_Response,
  computeActionByFqbnRequest,
  EventSourceHandlers,
  GetBoardByFqbn_Params,
  GetBoardByFqbn_Response,
  getBoardByFqbnRequest,
  GetBoards_Response,
  GetBoardsByVidPid_Params,
  getBoardsByVidPidRequest,
  getBoardsRequest,
  getBuilderCompilationOutputRequest,
  getBuilderFileContentsRequest,
  getCompilationStreamRequest,
  getCreatedSketchCompilationRequest,
  GetExamples_Params,
  getExamplesRequest,
  GetFavoriteLibraries_Response,
  getFavoriteLibrariesRequest,
  GetLibraries_Params,
  getLibrariesRequest,
  GetLibrary_Params,
  getLibraryRequest,
  LibrariesItem_Response,
  postCancelSketchCompilationRequest,
  postCreateSketchCompilationRequest,
  removeFavoriteLibraryRequest,
} from '@cloud-editor-mono/infrastructure';
import { WebSerialPort } from '@cloud-editor-mono/web-board-communication';
import { sortBy, uniqueId } from 'lodash';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { transformDataToContentByMimeType } from '../utils';
import {
  AddBoardInfoToPortResult,
  CompileSketch_Body_WithCompleteSketch,
  CompileSketch_ResponseDerivatives,
  CompleteExample,
  CompleteLibraryDetailsResult,
  GetLibrariesResult,
  GetUploadInfoPayload,
  isCompleteExample,
  OnStreamProgress,
  OnStreamResult,
  OnStreamStatus,
  OnStreamStdMsg,
  RetrieveExampleFileContentsResult,
} from './builderApiService.type';
import { parseError } from './utils';

export async function builderIsAlive(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  try {
    const res = await builderAliveRequest(token);
    return res?.status == 200;
  } catch (error) {
    return false;
  }
}

/**
 * In the unlikely case of generic not code-related errors (e.g. "internal error" from the API)
 * we're setting up a 'fake' diagnostics object which will be shown in the console in red, instead
 * of leaving the console empty, with no error message visible to the user.
 *
 * Example of failed result:
 ```json
  "data": {"status":"failed","error":"Platform 'esp8266:esp8266' not found: platform not installed"}
  ```
 * Example of successful result (which will return `null`):
  ```json
  "data": {"status":"completed","executable_sections_size":[{"name":"text","size":52376,"max_size":262144},{"name":"data","size":6744,"max_size":32768}]}
  ```
 * 
 * @param {object} data
 * @param {string} [data.status] value of `data.status` field. can be 'failed' or 'completed'
 * @param {string} [data.error] value of `data.error` as returned by the builder
 * @returns a string with the error is the builder notifies a failure, `null` otherwise
 */
function buildDiagnosticsForUnexpectedError(data: {
  status: 'failed' | 'completed';
  error?: string;
}): string | null {
  if (data && data.status === 'failed') {
    return data.error || 'Unknown error';
  }
  return null;
}

export function parseCompileData(
  stdout?: string,
  stderr?: string,
  sketchName?: string,
  hasSecretsIncludeInjected?: boolean,
  builderError?: string,
): CompileSketch_ResponseDerivatives {
  const newLineRegEx = /\r\n|\r|\n/;
  // If there are no compilation errors, but one builder-api error, we will use it
  // Anyway, precedence goes to stderr if present
  if (builderError && !stderr) {
    return {
      output: builderError,
      errors: [],
      failed: true,
      settled: true,
      warnLineStart: 1,
      warnLineEnd: builderError.split(newLineRegEx).length,
      outputLineEnd: 1,
    };
  }

  let errors =
    stderr && sketchName ? parseError(stderr, sketchName) : undefined;

  if (errors && hasSecretsIncludeInjected) {
    errors = errors.map((e) => {
      return { ...e, row: String(Number(e.row) - 1) };
    });
  }

  const errorKeywordInStderr =
    !!stderr &&
    (stderr.indexOf('error') !== -1 || stderr.indexOf('#error') !== -1);
  const errorKeywordInStdout =
    !!stdout &&
    (stdout.indexOf('[error]') !== -1 || stdout.indexOf('#error') !== -1);

  const stdoutLineCount = stdout
    ? stdout.split(newLineRegEx).length
    : undefined;

  const stdoutLineStart = stdout ? 1 : undefined;
  const stdoutLineEnd = stdoutLineCount;

  const stderrLineStart =
    stdoutLineCount && stderr ? stdoutLineCount + 1 : stderr ? 1 : undefined;
  const stderrLineEnd =
    stderrLineStart && stderr
      ? stderrLineStart + stderr.split(newLineRegEx).length
      : undefined;

  const warnFromStartOfOutput = errorKeywordInStdout;
  const warnUntilEndOfStdErr = stderrLineEnd !== undefined;

  const output = [stdout, stderr].filter(Boolean).join('\n\n');

  const outputLineEnd = output.split(newLineRegEx).length;

  return {
    output,
    errors,
    failed: errorKeywordInStderr || errorKeywordInStdout,
    settled: true,
    warnLineStart: warnFromStartOfOutput ? stdoutLineStart : stderrLineStart,
    warnLineEnd: warnUntilEndOfStdErr
      ? stderrLineEnd
      : errorKeywordInStdout
      ? stdoutLineEnd
      : undefined,
    outputLineEnd,
  };
}

export async function createSketchCompilation(
  {
    sketch,
    ota = false,
    verbose = false,
    ...bodyRest
  }: CompileSketch_Body_WithCompleteSketch,
  abortController?: AbortController,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return postCreateSketchCompilationRequest(
    { ...bodyRest, sketch, ota, verbose },
    token,
    abortController,
  );
}

export async function getCreatedSketchCompilation(
  id: string,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return getCreatedSketchCompilationRequest({ id }, token);
}

export async function cancelSketchCompilation(
  id: string,
): Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return postCancelSketchCompilationRequest({ id }, token);
}

// this var is used to mitigate multiple calls to this method
// creating multiple event source... if that's even possible...
let compilationStream:
  | {
      id: string;
      lastAbortController?: AbortController;
    }
  | undefined;

export function clearCompilationStream(): void {
  if (compilationStream?.lastAbortController) {
    compilationStream.lastAbortController.abort('User interrupted compilation');
  }
  compilationStream = undefined;
}

export async function startSketchCompilationStream(
  id: string,
  onStout: OnStreamStdMsg,
  onStderr: OnStreamStdMsg,
  onStatus: OnStreamStatus,
  onProgress: OnStreamProgress,
  onResult: OnStreamResult,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
): Promise<void> {
  if (compilationStream) {
    console.error(
      `A compilation stream is already open for compilation id: ${compilationStream.id}`,
    );
    return;
  }

  compilationStream = {
    id,
    lastAbortController: abortController,
  };

  try {
    const token = await getAccessToken();
    if (!token) {
      compilationStream = undefined;
      return noTokenReject();
    }

    const onmessage: EventSourceHandlers['onmessage'] = (event) => {
      const messageType = event.event;
      const data = JSON.parse(event.data);

      switch (messageType) {
        case CompilationStreamMessageType.Stdout:
          onStout('out', data.timestamp, data.lines);
          break;

        case CompilationStreamMessageType.Stderr:
          onStderr('err', data.timestamp, data.lines);
          break;

        case CompilationStreamMessageType.Status:
          onStatus(data.status);
          break;

        case CompilationStreamMessageType.Progress:
          onProgress(data.progress);
          break;

        case CompilationStreamMessageType.Result: {
          // a message of type 'result' can contain errors if the compilation hasn't even started
          const diagnostics =
            data.diagnostics || buildDiagnosticsForUnexpectedError(data);

          onResult(
            diagnostics,
            data.status === 'failed'
              ? data.error || 'Unknown error'
              : undefined,
          );
          break;
        }
      }
      handlers.onmessage?.(event);
    };

    if (abortController) {
      abortController.signal.onabort = (): void => {
        compilationStream = undefined;
      };
    }

    await getCompilationStreamRequest(
      { id },
      {
        ...handlers,
        onclose: () => {
          compilationStream = undefined;
          handlers.onclose?.();
        },
        onmessage,
      },
      token,
      abortController,
    );
    return;
  } catch (error) {
    compilationStream = undefined;
    throw error;
  }
}

export async function getCompilationOutput(
  id: string,
): Promise<CompileSketch_Response & { name: string }> {
  const token = await getAccessToken();
  if (!token) {
    return noTokenReject();
  }

  const response = await getBuilderCompilationOutputRequest({ id }, token);

  return response;
}

export async function getAllSupportedBoards(): Promise<GetBoards_Response> {
  const { boards, ...rest } = await getBoardsRequest();

  return {
    ...rest,
    boards: sortBy(boards, ['name']),
  };
}

export async function addBoardInfoToPort(
  params: GetBoardsByVidPid_Params,
  port: AgentPort | WebSerialPort,
): Promise<AddBoardInfoToPortResult> {
  const unknownBoard = { ...port, id: uniqueId(), isUnknownBoard: true };

  if (
    params.vid.toLocaleLowerCase() === '0x303a' &&
    params.pid.toLocaleLowerCase() === '0x1001'
  ) {
    // esp32 boards have same pid and vid for different models
    // treat them as "unknown" boards and prop the user to select the correct model
    // https://github.com/espressif/arduino-esp32/issues/6384#issuecomment-2089833800
    return unknownBoard;
  }

  let board;
  try {
    board =
      (port as WebSerialPort).fqbn === UNKNOWN_BOARD_FQBN
        ? {
            id: uniqueId(),
            isUnknownBoard: true,
          }
        : await getBoardsByVidPidRequest(params);
  } catch {
    return unknownBoard;
  }

  return { ...port, ...board };
}

export function getBoardByFqbn(
  params: GetBoardByFqbn_Params,
): Promise<GetBoardByFqbn_Response> {
  return getBoardByFqbnRequest(params);
}

export async function getUploadInfo({
  fqbn,
  agentOS,
}: GetUploadInfoPayload): Promise<Compute_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return computeActionByFqbnRequest({ fqbn }, { verbose: true, os: agentOS });
}

export async function getLibraries(
  params: GetLibraries_Params,
): Promise<GetLibrariesResult> {
  const result = await getLibrariesRequest(params);

  return { ...result, fromParams: JSON.stringify(params) };
}

export async function getLibrary(
  params: GetLibrary_Params,
): Promise<CompleteLibraryDetailsResult> {
  const data = await getLibraryRequest(params);

  return {
    ...data,
    examples: data.examples
      ? data.examples.filter(isCompleteExample)
      : undefined,
  };
}

export async function getExamples(
  params: GetExamples_Params,
): Promise<CompleteExample[]> {
  const response = await getExamplesRequest(params);

  return response.examples.filter(isCompleteExample);
}

export async function getFavoriteLibraries(): Promise<GetFavoriteLibraries_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();
  return getFavoriteLibrariesRequest(token);
}

export async function setFavoriteLibrary(
  { id }: LibrariesItem_Response,
  asFavorite: boolean,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();
  if (asFavorite) return addFavoriteLibraryRequest({ id }, token);
  return removeFavoriteLibraryRequest({ id }, token);
}

export async function retrieveExampleFileContents(
  filePath: string,
  // an example file href contains the endpoint, here we pass just the path to keep the infrastructure api method more transparent
  fullName: string,
  exampleInoPath?: string,
  scope?: FileLineScope,
): Promise<RetrieveExampleFileContentsResult> {
  const { data, mimetype, href } = await getBuilderFileContentsRequest({
    path: filePath,
  });
  if (typeof data === 'undefined')
    return Promise.reject(
      new Error('No data to decode in retrieved example file'),
    );

  const extension = filePath.substring(filePath.lastIndexOf('.') + 1);

  const content = transformDataToContentByMimeType(data, mimetype);

  const scopedContent =
    scope &&
    content
      .split('\n')
      .slice(scope.start, scope.end + 1)
      .join('\n');

  return {
    name: trimFileExtension(fullName),
    fullName,
    extension,
    data,
    content,
    scopedContent,
    mimetype,
    path: filePath,
    href: href || '',
    exampleInoPath,
  };
}

export async function retrieveLibraryFileContents(
  filePath: string,
  fullName: string,
): Promise<RetrieveExampleFileContentsResult> {
  const { data, mimetype, href } = await getBuilderFileContentsRequest({
    path: filePath,
  });
  if (typeof data === 'undefined')
    return Promise.reject(
      new Error('No data to decode in retrieved library file'),
    );

  let extension;
  if (fullName.toLocaleLowerCase().indexOf('license') !== -1) {
    extension = 'txt';
  } else {
    extension = filePath.substring(filePath.lastIndexOf('.') + 1);
  }

  return {
    name: trimFileExtension(fullName),
    fullName,
    extension,
    data,
    content: transformDataToContentByMimeType(data, mimetype),
    mimetype,
    href: href || '',
    path: filePath,
  };
}
