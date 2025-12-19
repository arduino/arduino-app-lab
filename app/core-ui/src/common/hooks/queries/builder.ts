import {
  COMPILE_STREAM_UPDATE,
  uploadResponseStreamNext,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';
import { pickMainIno } from '@cloud-editor-mono/common';
import {
  daemonState,
  setAgentDaemonState,
  uploadToAgentPort,
  UploadToAgentPortPayload,
} from '@cloud-editor-mono/create-agent-client-ts';
import {
  cancelSketchCompilation,
  CompileSketch_Result,
  createSketchCompilation,
  ga4Emitter,
  getAllSupportedBoards,
  getBoardByFqbn,
  getCompilationOutput,
  getCreatedSketchCompilation,
  getExamples,
  getFavoriteLibraries,
  getLibraries,
  getLibrary,
  getUploadInfo,
  NotificationMode,
  NotificationType,
  OnStreamProgress,
  OnStreamResult,
  OnStreamStatus,
  OnStreamStdMsg,
  parseCompileData,
  retrieveExampleFileContents,
  RetrieveExampleFileContentsResult,
  retrieveLibraryFileContents,
  RetrieveLibraryFileContentsResult,
  sendAnalyticsEvent,
  sendNotification,
  setCodeSubjects,
  setFavoriteLibrary,
  startSketchCompilationStream,
} from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  Compute_Response,
  EventSourceHandlers,
  GetFavoriteLibraries_Response,
  getReleaseExampleFilesRequest,
  IsFavoriteLibrary,
  LibrariesItem_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import {
  Example,
  ExamplesFolder,
  ToastSize,
  ToastType,
} from '@cloud-editor-mono/ui-components';
import {
  setWebSerialState,
  uploadToWebSerialPort,
  UploadToWebSerialPortPayload,
  webSerialState,
  WebSerialStateKeys,
} from '@cloud-editor-mono/web-board-communication';
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IntlContext } from 'react-intl';

import { BUILTIN_EXAMPLES_QUERY_KEY } from '../../../cloud-editor/features/main/hooks/examples';
import { useSketchParams } from '../../../cloud-editor/features/main/hooks/sketch';
import {
  compileDataWasStored,
  useCacheCompile,
} from '../../../cloud-editor/features/main/hooks/utils';
import { BaseUploadCommandOptions } from '../../../cloud-editor/features/main/main.type';
import { AuthContext } from '../../providers/auth/authContext';
import {
  CompileComputeAndUploadPayload,
  CompilePayload,
  ComputeAndUploadPayload,
  SetFavouriteLibraryContext,
  SetFavouriteLibraryPayload,
  uploadAgentPayloadIsComplete,
  uploadWebSerialPayloadIsComplete,
  UseCompileComputeUpload,
  UseGetBoardByFqbn,
  UseGetBoardsList,
  UseGetExamples,
  UseGetFavoriteLibraries,
  UseGetLibraries,
  UseGetLibrary,
  UseRetrieveExampleFileContents,
  UseRetrieveExampleInoContents,
  UseRetrieveLibraryFileContents,
  UseVerifySketch,
} from './builder.type';
import { Progression } from './iot.type';
import { messages } from './messages';

function concatErrors(
  compilationErrors?: string[],
  builderError?: string,
): string[] | undefined {
  if (!builderError) {
    return compilationErrors;
  } else {
    if (compilationErrors) {
      return [...compilationErrors, builderError];
    }
  }
  return compilationErrors;
}

export const useGetBoardByFqbn: UseGetBoardByFqbn = function (
  enabled: boolean,
  fqbn?: string,
): ReturnType<UseGetBoardByFqbn> {
  const { data, isLoading } = useQuery(
    ['get-board-by-fqbn', fqbn],
    () =>
      fqbn !== undefined
        ? getBoardByFqbn({ fqbn })
        : Promise.reject('FQBN is not defined'),
    {
      refetchOnWindowFocus: false,
      enabled,
    },
  );

  return {
    board: data,
    isLoading,
  };
};

export const useVerifySketch: UseVerifySketch =
  function (): ReturnType<UseVerifySketch> {
    const { formatMessage } = useContext(IntlContext);

    const { deleteCompilationData: deleteCachedCompileData } =
      useCacheCompile();

    const {
      createCompilation,
      cancelAndReset: cancelStream,
      isCompiling: isCompilingWithStream,
      data: compileStreamData,
      createdSketchCompilation,
      openCompilationStreamById,
      progress: compileProgress,
      compileResultMessages,
      errorFiles,
    } = useCompilationStream();

    //Cancel and reset for the verification process for both old and new builder
    const cancelAndReset = useCallback(
      async (notify?: boolean, sketchId?: string) => {
        deleteCachedCompileData();

        //If compiling with the new builder, we need to cancel the stream
        if (isCompilingWithStream) {
          try {
            await cancelStream();
          } catch (e) {
            sendNotification({
              message: formatMessage(
                messages.notificationVerifyCouldNotBeInterrupted,
              ),
              mode: NotificationMode.Toast,
              type: NotificationType.Change,
              modeOptions: {
                toastType: ToastType.Passive,
                toastSize: ToastSize.Small,
              },
            });
            return;
          }
        } else {
          cancelStream();
        }

        if (notify) {
          sendNotification({
            message: formatMessage(messages.notificationVerifyInterrupt),
            mode: NotificationMode.Toast,
            type: NotificationType.Change,
            modeOptions: {
              toastType: ToastType.Passive,
              toastSize: ToastSize.Small,
            },
          });

          sendAnalyticsEvent({
            data: {
              sketch: sketchId,
              board: null,
              board_type: null,
              hex_len: null,
              error_code: 'C3',
              error_message: 'aborted',
            },
            subtype: 'verify',
          });
        }
      },
      [
        cancelStream,
        deleteCachedCompileData,
        formatMessage,
        isCompilingWithStream,
      ],
    );

    return {
      isVerifying: isCompilingWithStream,
      compileHasFailed: Boolean(compileStreamData?.failed),
      continuePreviousCompilationById: openCompilationStreamById,
      compileSketchResponseData: compileStreamData,
      reset: cancelAndReset,
      createCompilation,
      createdSketchCompilation,
      compileProgress,
      compileResultMessages,
      errorFiles,
    };
  };

interface StreamHandlers {
  onStreamClose: Exclude<EventSourceHandlers['onclose'], undefined>;
  onStreamErrored: Exclude<EventSourceHandlers['onerror'], undefined>;
  onStreamStdMsg: OnStreamStdMsg;
  onStreamStatus: OnStreamStatus;
  onStreamProgress: OnStreamProgress;
  onResult: OnStreamResult;
}

const createStreamHandlers = (
  setIsPending: Dispatch<SetStateAction<boolean>>,
  setStreamErrored: Dispatch<SetStateAction<boolean>>,
  setStdOut: Dispatch<SetStateAction<string | undefined>>,
  setStdErr: Dispatch<SetStateAction<string | undefined>>,
  setStatus: Dispatch<SetStateAction<string | undefined>>,
  setProgress: Dispatch<SetStateAction<Progression | undefined>>,
  setResult: Dispatch<SetStateAction<'success' | 'failure' | undefined>>,
  setCompileResultMessages: Dispatch<SetStateAction<string | undefined>>,
  setErrorFiles: Dispatch<SetStateAction<string[] | undefined>>,
  setBuilderError: Dispatch<SetStateAction<string | undefined>>,
): StreamHandlers => {
  const onStreamClose: EventSourceHandlers['onclose'] = () => {
    setIsPending(false);
    setProgress(undefined);
  };

  const onStreamErrored: EventSourceHandlers['onerror'] = () => {
    setStreamErrored(true);
  };

  const onStreamStdMsg: OnStreamStdMsg = (type, ts, line) => {
    if (type === 'err') {
      setStdErr((prev) => {
        return prev ? `${prev}${line}` : line;
      });
      return;
    }

    setStdOut((prev) => {
      return prev ? `${prev}${line}` : line;
    });
  };

  const onStreamStatus: OnStreamStatus = (status) => {
    setStatus(status);
  };

  const onStreamProgress: OnStreamProgress = (progress) => {
    const integerProgress = Math.floor(progress);
    setProgress(integerProgress as Progression);
  };

  const onResult: OnStreamResult = (diagnostics, builderError) => {
    setResult(!diagnostics ? 'success' : 'failure');
    setBuilderError(builderError);
    const { compileResultMessages = undefined, errorFiles = undefined } =
      diagnostics
        ? diagnostics.reduce<{
            compileResultMessages: string[];
            errorFiles: string[];
          }>(
            (acc, diagnostic) => {
              acc.compileResultMessages.push(diagnostic.message);
              acc.errorFiles.push(diagnostic.file);
              return acc;
            },
            { compileResultMessages: [], errorFiles: [] },
          )
        : {};

    const cumulativeErrors = concatErrors(compileResultMessages, builderError);
    setCompileResultMessages(cumulativeErrors && cumulativeErrors.join('\n'));
    setErrorFiles(errorFiles);
  };

  return {
    onStreamClose,
    onStreamErrored,
    onStreamStdMsg,
    onStreamStatus,
    onStreamProgress,
    onResult,
  };
};

type UseCreateCompilation = () => {
  openCompilationStreamById: (
    data: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  createCompilation: (payload: CompilePayload) => void;
  cancelAndReset: () =>
    | Promise<ArduinoBuilderV2CompilationsResponse_BuilderApi>
    | undefined;
  isCreatingCompilation: boolean;
  resetCreateCompilation: () => void;
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi & {
    sketchName?: string;
  };
  isPending: boolean;
  setIsPending: Dispatch<SetStateAction<boolean>>;
};
const useCreateCompilation: UseCreateCompilation = function () {
  const [createdSketchCompilation, setCreatedSketchCompilation] = useState<
    ArduinoBuilderV2CompilationsResponse_BuilderApi & { sketchName?: string }
  >();
  const [isPending, setIsPending] = useState(false);

  const abortControllerCreate = useRef<AbortController>();

  const queryClient = useQueryClient();

  const { setCompilationData } = useCacheCompile();

  const {
    isLoading: isCreatingCompilation,
    mutate: createCompilation,
    reset: resetCreateCompilation,
  } = useMutation({
    mutationFn: ({
      hasSecretsIncludeInjected: _,
      commandType: __,
      ...rest
    }: CompilePayload) =>
      createSketchCompilation(rest, abortControllerCreate.current),
    onMutate: () => {
      abortControllerCreate.current = new AbortController();
    },
    onSuccess: (data, variables) => {
      setCreatedSketchCompilation({
        ...data,
        sketchName: variables.sketch?.name,
      });

      if (variables.shouldCache) {
        setCompilationData(data.id, variables.fqbn, variables.commandType);
      }

      setIsPending(true);
      queryClient.invalidateQueries(['user-restrictions-recap'], {
        exact: false,
      });
    },
    onSettled: () => {
      abortControllerCreate.current = undefined;
    },
  });

  const openCompilationStreamById = useCallback(
    (data: ArduinoBuilderV2CompilationsResponse_BuilderApi): void => {
      setCreatedSketchCompilation(data);

      setIsPending(true);
      queryClient.invalidateQueries(['user-restrictions-recap'], {
        exact: false,
      });
    },
    [queryClient],
  );

  const { mutateAsync: cancelCompilation } = useMutation({
    mutationFn: (id: string) => cancelSketchCompilation(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['user-restrictions-recap'], {
        exact: false,
      });
    },
  });

  const cancelAndReset = useCallback(() => {
    abortControllerCreate.current?.abort(
      'User interrupted compilation creation',
    );
    abortControllerCreate.current = undefined;
    resetCreateCompilation();
    setCreatedSketchCompilation(undefined);
    setIsPending(false);

    return createdSketchCompilation
      ? cancelCompilation(createdSketchCompilation.id)
      : undefined;
  }, [cancelCompilation, createdSketchCompilation, resetCreateCompilation]);

  return {
    createCompilation,
    cancelAndReset,
    isCreatingCompilation,
    resetCreateCompilation,
    openCompilationStreamById,
    createdSketchCompilation,
    isPending,
    setIsPending,
  };
};

type UseCompilationStream = () => {
  cancelAndReset: () => Promise<
    ArduinoBuilderV2CompilationsResponse_BuilderApi | undefined
  >;
  createCompilation: (payload: CompilePayload) => void;
  isCompiling: boolean;
  isPending: boolean;
  streamErrored: boolean;
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi;
  openCompilationStreamById: (
    data: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  progress?: Progression;
  data?: CompileSketch_Result;
  compileResultMessages?: string;
  errorFiles?: string[];
};

export const useCompilationStream: UseCompilationStream =
  function (): ReturnType<UseCompilationStream> {
    const { deleteCompilationData: deleteCachedCompileData } =
      useCacheCompile();

    const [streamErrored, setStreamErrored] = useState(false);

    const [stdOut, setStdOut] = useState<string>();
    const [stdErr, setStdErr] = useState<string>();
    const [status, setStatus] = useState<string>();
    const [progress, setProgress] = useState<Progression>();

    const [result, setResult] = useState<'success' | 'failure'>();
    const [compileResultMessages, setCompileResultMessages] =
      useState<string>();
    const [errorFiles, setErrorFiles] = useState<string[]>();
    const [builderError, setBuilderError] = useState<string>();

    const abortControllerStream = useRef<AbortController>();

    const {
      createdSketchCompilation,
      cancelAndReset: cancelAndResetCreation,
      setIsPending,
      resetCreateCompilation,
      openCompilationStreamById,
      isPending,
      createCompilation,
      isCreatingCompilation,
    } = useCreateCompilation();

    const cancelAndReset = useCallback(async () => {
      abortControllerStream.current?.abort('User interrupted compilation');
      abortControllerStream.current = undefined;

      setStdOut(undefined);
      setStdErr(undefined);
      setStatus(undefined);
      setProgress(undefined);
      setResult(undefined);
      setCompileResultMessages(undefined);
      setErrorFiles(undefined);
      setBuilderError(undefined);

      return cancelAndResetCreation();
    }, [cancelAndResetCreation]);

    useEffect(() => {
      if (createdSketchCompilation) {
        abortControllerStream.current = new AbortController();
        const {
          onStreamClose,
          onStreamErrored,
          onStreamStdMsg,
          onStreamStatus,
          onStreamProgress,
          onResult,
        } = createStreamHandlers(
          setIsPending,
          setStreamErrored,
          setStdOut,
          setStdErr,
          setStatus,
          setProgress,
          setResult,
          setCompileResultMessages,
          setErrorFiles,
          setBuilderError,
        );

        startSketchCompilationStream(
          createdSketchCompilation.id,
          onStreamStdMsg,
          onStreamStdMsg,
          onStreamStatus,
          onStreamProgress,
          onResult,
          {
            onopen: undefined,
            onerror: onStreamErrored,
            onmessage: undefined,
            onclose: () => {
              resetCreateCompilation();
              onStreamClose();

              deleteCachedCompileData();
            },
          },
          abortControllerStream.current,
        );
      }
    }, [
      createdSketchCompilation,
      deleteCachedCompileData,
      resetCreateCompilation,
      setIsPending,
    ]);

    useEffect(() => {
      if (result !== undefined) {
        abortControllerStream.current = undefined;
      }
    }, [result]);

    const data: CompileSketch_Result | undefined = useMemo(() => {
      const derivatives =
        result !== undefined
          ? parseCompileData(
              stdOut,
              stdErr,
              createdSketchCompilation?.sketchName,
              false,
              builderError,
            )
          : undefined;

      const getOutput = (): string => {
        const hasOutput = Boolean(stdOut || stdErr);

        if (!hasOutput) return '';

        return [stdOut, stdErr].filter(Boolean).join('\n\n');
      };

      return {
        output: getOutput(),
        status,
        progress,
        outputLineEnd: 0,
        failed: false,
        settled: false,
        // Properties are overridden by derivatives
        ...derivatives,
      };
    }, [
      result,
      stdOut,
      stdErr,
      createdSketchCompilation,
      status,
      progress,
      builderError,
    ]);

    return {
      openCompilationStreamById,
      createCompilation,
      cancelAndReset,
      isPending,
      streamErrored,
      createdSketchCompilation,
      data,
      progress,
      isCompiling: isCreatingCompilation || isPending,
      compileResultMessages,
      errorFiles,
    };
  };

type UseCompileComputeAndUploadQueries = (
  agentEnabled: boolean,
  isVerifying?: boolean,
  computeAndUploadPayload?: CompileComputeAndUploadPayload,
  onUploadStart?: () => void,
  compileSketchResponseData?: CompileSketch_Result,
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
) => {
  isComputing: boolean;
  isFetchingCompilationOutput: boolean;
  getCompilationOutputFailed: boolean;
  webSerialIsUploading: boolean;
  webSerialUploadOutput: UploadStatus | undefined;
  agentIsUploading: boolean;
  agentUploadOutput: UploadStatus | undefined;
};

export const useCompileComputeAndUploadQueries: UseCompileComputeAndUploadQueries =
  function (
    agentEnabled: boolean,
    isVerifying?: boolean,
    computeAndUploadPayload?: CompileComputeAndUploadPayload,
    onUploadStart?: () => void,
    compileSketchResponseData?: CompileSketch_Result,
    createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ): ReturnType<UseCompileComputeAndUploadQueries> {
    // On getCompilationOutput, BE responds with extra_files on builderV2 instead of files like builderV1. On the function we modify the response
    const {
      isFetching: isFetchingCompilationOutput,
      isError: getCompilationOutputFailed,
    } = useQuery(
      [
        'get-compilation-output',
        createdSketchCompilation?.id,
        computeAndUploadPayload,
      ],
      () =>
        createdSketchCompilation?.id
          ? getCompilationOutput(createdSketchCompilation?.id)
          : Promise.reject(new Error('No sketch ID provided')),
      {
        onSuccess(data) {
          if (computeAndUploadPayload) {
            compute({
              computePayload: computeAndUploadPayload.computePayload,
              partialUploadPayload: {
                ...computeAndUploadPayload.partialUploadPayload,
                compileData: data,
              },
            });
          }
        },
        enabled:
          !!createdSketchCompilation?.id &&
          !isVerifying &&
          !!computeAndUploadPayload &&
          compileSketchResponseData?.settled &&
          !compileSketchResponseData?.failed,
      },
    );

    const { isLoading: isComputing, mutate: compute } = useMutation({
      mutationFn: (payload: ComputeAndUploadPayload) =>
        getUploadInfo(payload.computePayload),
      onSuccess: (
        data: Compute_Response,
        variables: ComputeAndUploadPayload,
      ) => {
        const uploadPayload = variables.partialUploadPayload;
        if (agentEnabled) {
          if (!uploadAgentPayloadIsComplete(uploadPayload)) return;
          agentUpload({
            ...uploadPayload,
            computeUploadInfo: data,
          });
        } else {
          if (!uploadWebSerialPayloadIsComplete(uploadPayload)) return;
          webSerialUpload({
            ...uploadPayload,
            computeUploadInfo: data,
          });
        }
      },
    });

    const {
      data: agentUploadOutput,
      isLoading: agentIsUploading,
      mutate: agentUpload,
    } = useMutation({
      mutationFn: uploadToAgentPort,
      onMutate: onUploadStart,
      onSuccess: (
        result: UploadStatus,
        variables: UploadToAgentPortPayload,
      ) => {
        sendAnalyticsEvent({
          data: {
            board: variables.fqbn,
            board_type: variables.boardType,
            sketch: variables.sketchId,
            hex_len: variables.compileData.hex?.length ?? null,
            error_code: result === UploadStatus.ERROR ? 'C2' : null,
            error_message:
              result === UploadStatus.ERROR ? 'Upload failed' : null,
          },
          subtype: 'upload',
        });
      },
    });

    const {
      data: webSerialUploadOutput,
      isLoading: webSerialIsUploading,
      mutate: webSerialUpload,
    } = useMutation({
      mutationFn: uploadToWebSerialPort,
      onMutate: () => {
        setWebSerialState({
          [WebSerialStateKeys.UploadStatus]: UploadStatus.IN_PROG,
        });
        onUploadStart && onUploadStart();
      },
      onSuccess: (
        result: UploadStatus,
        variables: UploadToWebSerialPortPayload,
      ) => {
        sendAnalyticsEvent({
          data: {
            board: variables.fqbn,
            board_type: variables.boardType,
            sketch: variables.sketchId,
            hex_len: variables.compileData.hex?.length ?? null,
            error_code: result === UploadStatus.ERROR ? 'C2' : null,
            error_message:
              result === UploadStatus.ERROR ? 'Upload failed' : null,
          },
          subtype: 'upload',
        });
      },
    });

    return {
      webSerialUploadOutput,
      webSerialIsUploading,
      agentUploadOutput,
      agentIsUploading,
      isComputing,
      isFetchingCompilationOutput,
      getCompilationOutputFailed,
    };
  };

export const useCompileComputeAndUpload: UseCompileComputeUpload = function (
  agentEnabled: boolean,
  onUploadStart?: () => void,
): ReturnType<UseCompileComputeUpload> {
  const {
    reset,
    createCompilation,
    isVerifying,
    compileProgress,
    compileSketchResponseData,
    createdSketchCompilation,
    compileResultMessages,
    errorFiles,
  } = useVerifySketch();

  useEffect(() => {
    if (createdSketchCompilation && compileSketchResponseData?.output) {
      if (!agentEnabled) {
        uploadResponseStreamNext(
          setWebSerialState,
          webSerialState,
          compileSketchResponseData.output,
          {
            signal: COMPILE_STREAM_UPDATE,
          },
        );
      } else {
        uploadResponseStreamNext(
          setAgentDaemonState,
          daemonState,
          compileSketchResponseData.output,
          {
            signal: COMPILE_STREAM_UPDATE,
          },
        );
      }
    }
  }, [
    createdSketchCompilation,
    compileSketchResponseData?.output,
    agentEnabled,
  ]);

  const [computeAndUploadPayload, setComputeAndUploadPayload] =
    useState<CompileComputeAndUploadPayload>();
  const compileComputeAndUpload = useCallback(
    (payload: CompileComputeAndUploadPayload): void => {
      setComputeAndUploadPayload(payload);
      createCompilation(payload.compilePayload);
    },
    [createCompilation],
  );

  // On getCompilationOutput, BE responds with extra_files on builderV2 instead of files like builderV1. On the function we modify the response
  const {
    isComputing,
    isFetchingCompilationOutput,
    getCompilationOutputFailed,
    webSerialIsUploading,
    webSerialUploadOutput,
    agentUploadOutput,
    agentIsUploading,
  } = useCompileComputeAndUploadQueries(
    agentEnabled,
    isVerifying,
    computeAndUploadPayload,
    onUploadStart,
    compileSketchResponseData,
    createdSketchCompilation,
  );

  return {
    isCompiling: isVerifying || isFetchingCompilationOutput,
    isComputing,
    isUploading: agentEnabled ? agentIsUploading : webSerialIsUploading,
    compileHasFailed:
      Boolean(compileSketchResponseData?.failed) || getCompilationOutputFailed,
    compilationProgress: compileProgress,
    compileOutput: compileSketchResponseData?.output,
    compileErrors: compileSketchResponseData?.errors,
    compileWarnLineStart: compileSketchResponseData?.warnLineStart,
    compileWarnLineEnd: compileSketchResponseData?.warnLineEnd,
    uploadOutputLineStart: compileSketchResponseData?.outputLineEnd
      ? compileSketchResponseData.outputLineEnd + 1
      : undefined,
    uploadOutput: agentEnabled ? agentUploadOutput : webSerialUploadOutput,
    compileComputeAndUpload,
    reset,
    compileResultMessages,
    errorFiles,
  };
};

export const useGetBoardsList: UseGetBoardsList = function (
  enabled = true,
): ReturnType<UseGetBoardsList> {
  const { data, isLoading } = useQuery(
    ['boards'],
    () => getAllSupportedBoards(),
    { enabled, refetchOnWindowFocus: false },
  );

  return {
    data,
    isLoading,
  };
};

const FAVORITE_LIBRARIES_QUERY_KEY = ['favorite-libraries'];
export const useFavoriteLibraries: UseGetFavoriteLibraries = function (
  enabled = true,
): ReturnType<UseGetFavoriteLibraries> {
  const profile = useContext(AuthContext);
  const userWasAuthenticated = Boolean(profile.user);

  const { sketchID } = useSketchParams();

  const { data, isLoading, isError } = useQuery(
    FAVORITE_LIBRARIES_QUERY_KEY,
    getFavoriteLibraries,
    {
      enabled: enabled && userWasAuthenticated,
    },
  );

  const queryClient = useQueryClient();
  const { mutate } = useMutation<
    unknown,
    unknown,
    SetFavouriteLibraryPayload,
    SetFavouriteLibraryContext
  >({
    mutationFn: ({ library, asFavorite }: SetFavouriteLibraryPayload) =>
      setFavoriteLibrary(library, asFavorite),
    onMutate: async ({ library, asFavorite }) => {
      await queryClient.cancelQueries({
        queryKey: FAVORITE_LIBRARIES_QUERY_KEY,
      });

      const previousLibraries =
        queryClient.getQueryData<GetFavoriteLibraries_Response>(
          FAVORITE_LIBRARIES_QUERY_KEY,
        ) ?? [];

      const newLibraries = asFavorite
        ? [...previousLibraries, { ...library }]
        : previousLibraries.filter((l) => l.id !== library.id);

      queryClient.setQueryData<GetFavoriteLibraries_Response>(
        FAVORITE_LIBRARIES_QUERY_KEY,
        newLibraries,
      );

      return { previousLibraries };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_, __, context) => {
      if (context?.previousLibraries) {
        queryClient.setQueryData<GetFavoriteLibraries_Response>(
          FAVORITE_LIBRARIES_QUERY_KEY,
          context.previousLibraries,
        );
      }
    },
    onSettled: async () => {
      // wait a bit to make sure the query is invalidated before refetching
      queryClient.invalidateQueries({ queryKey: FAVORITE_LIBRARIES_QUERY_KEY });
    },
  });

  const setFavorite = useCallback(
    (library: LibrariesItem_Response, asFavorite: boolean) => {
      mutate({ library, asFavorite });
      ga4Emitter({
        type: 'LIBRARY_FAVORITE',
        payload: {
          name: library.name,
          sketch_id: sketchID || '',
        },
      });
    },
    [mutate, sketchID],
  );

  return { data, isLoading, isError, setFavorite };
};

export const useGetLibraries: UseGetLibraries = function (
  params,
  enabled = true,
): ReturnType<UseGetLibraries> {
  const [mappedLibraries, setMappedLibraries] = useState<{
    fromParams?: string;
    libs: LibrariesItem_Response[];
  }>();
  const {
    data: currentPagesData,
    isInitialLoading: isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery(
    ['libraries', params],
    (ctx) => {
      const page = ctx.pageParam || params.page;
      return getLibraries(page ? { ...params, page } : params);
    },
    {
      enabled,
      getNextPageParam: (lastGroup) => {
        const totalPages = lastGroup.pages;
        const nextPage = lastGroup.nextPage;

        if (!!nextPage && nextPage > totalPages) {
          return undefined; // signals to react-query that all pages have been loaded
        }

        return nextPage;
      },
      onError: () => {
        setMappedLibraries({
          fromParams: JSON.stringify(params),
          libs: [],
        });
      },
    },
  );

  const {
    data: favoriteLibrariesList,
    isLoading: isFavoriteLibrariesLoading,
    isError: getFavoritesIsError,
    setFavorite,
  } = useFavoriteLibraries(enabled);

  useEffect(() => {
    if (!currentPagesData) return;

    const data = currentPagesData.pages.flatMap((d) => d.libraries);

    const fromParams =
      currentPagesData.pages.length > 0
        ? currentPagesData.pages[0].fromParams
        : undefined;

    if (!favoriteLibrariesList || getFavoritesIsError) {
      setMappedLibraries({
        fromParams,
        libs: data.map((library) => ({
          ...library,
          isFavorite: IsFavoriteLibrary.Unknown,
        })),
      });
      return;
    }

    const mapped = data.map((library) => {
      const isFavorite = favoriteLibrariesList.some(
        (favoriteLibrary) => favoriteLibrary.id === library.id,
      );
      return {
        ...library,
        isFavorite: isFavorite ? IsFavoriteLibrary.Yes : IsFavoriteLibrary.No,
      };
    });

    setMappedLibraries({
      fromParams,
      libs: mapped,
    });
  }, [currentPagesData, favoriteLibrariesList, getFavoritesIsError]);

  return {
    libraries: mappedLibraries?.libs,
    fromParams: mappedLibraries?.fromParams,
    isLoading:
      isLoading ||
      isFavoriteLibrariesLoading ||
      typeof mappedLibraries?.libs === 'undefined',
    setFavorite,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  };
};

const toLegacyId = (name: string, version: string): string =>
  `${name
    .trim()
    .toLowerCase()
    .replace(/[\s-.]+/g, '_')}_${version
    .trim()
    .replace(/[^\d.]/g, '')
    .replace(/\./g, '_')}`;

const mapExampleFilesToLegacy = (
  legacyId: string,
  examplePath: string, // es. "arduino/LVGL_Arduino"
  files: { name: string; path: string; mimetype: string }[],
) => {
  const segs = examplePath.split('/').filter(Boolean);
  const exampleName = segs[segs.length - 1] || examplePath;
  const folder = segs[0] || '';

  const ino = pickMainIno(files);
  const inoLegacy = ino && {
    href: `/v1/files/${encodeURIComponent(
      `${legacyId}/examples/${examplePath}/${ino.name}`,
    )}`,
    mimetype:
      files.find((f) => f.name === ino.name)?.mimetype ||
      'text/x-c++src; charset=utf-8',
    name: ino.name,
    path: `${legacyId}/examples/${examplePath}/${ino.name}`,
  };

  return {
    folder,
    ino: inoLegacy,
    name: exampleName,
    path: `${legacyId}/${examplePath}`,
    types: ['library'],
  };
};

export const useGetLibrary: UseGetLibrary = function (
  { id },
  enabled,
): ReturnType<UseGetLibrary> {
  const { data, isLoading, refetch, isError } = useQuery(
    ['library', id],
    async () => {
      if (!id) throw new Error('no library id provided'); // reject promise
      const base = await getLibrary({ id });
      if (
        !base?.id ||
        !base?.version ||
        !Array.isArray(base.examples) ||
        base.examples.length === 0
      ) {
        return base;
      }

      const releaseId = `${base.id}@${base.version}`;
      const legacyId = toLegacyId(base.id, base.version);

      const legacyExamples = (
        await Promise.all(
          base.examples
            .filter((ex) => !!ex.path)
            .map(async (ex) => {
              try {
                const res = await getReleaseExampleFilesRequest({
                  id: releaseId,
                  path: ex.path!,
                });
                const files = res?.files ?? [];
                return mapExampleFilesToLegacy(legacyId, ex.path!, files);
              } catch {
                return null;
              }
            }),
        )
      ).filter(
        (
          ex,
        ): ex is NonNullable<ReturnType<typeof mapExampleFilesToLegacy>> & {
          ino: NonNullable<ReturnType<typeof mapExampleFilesToLegacy>['ino']>;
        } => ex !== null && ex.ino !== undefined,
      );
      return {
        ...base,
        examples: legacyExamples,
      };
    },
    { enabled },
  );

  return {
    library: data,
    refetch,
    isLoading,
    isError,
  };
};

export const useGetExamples: UseGetExamples = function (
  enableGetExamples = true,
): ReturnType<UseGetExamples> {
  const { isLoading, data, isError } = useQuery(
    BUILTIN_EXAMPLES_QUERY_KEY,
    () => getExamples({}),
    {
      refetchOnWindowFocus: false,
      enabled: enableGetExamples,
      refetchOnMount: false,
      keepPreviousData: true,
    },
  );

  return {
    examples: data || [],
    isLoading,
    isError,
  };
};

export const useRetrieveExampleInoContents: UseRetrieveExampleInoContents =
  function (
    enabled,
    exampleIno,
    scope,
  ): ReturnType<UseRetrieveExampleInoContents> {
    const { data: exampleInoContents, isLoading } = useQuery(
      ['get-main-example-content', exampleIno?.path, scope],
      () => {
        return exampleIno
          ? retrieveExampleFileContents(
              exampleIno.path,
              exampleIno.name,
              undefined,
              scope,
            )
          : Promise.reject('no example ino provided');
      },
      {
        onSuccess: (data: RetrieveExampleFileContentsResult) => {
          setCodeSubjects(data);
        },
        refetchOnWindowFocus: false,
        enabled,
      },
    );

    return {
      isLoading,
      exampleInoContents,
    };
  };

export const useRetrieveExampleFileContents: UseRetrieveExampleFileContents =
  function (
    enabled,
    onSuccess?,
    exampleInoPath?,
    exampleFiles?,
  ): ReturnType<UseRetrieveExampleFileContents> {
    const [exampleFileContents, setExampleFileContents] = useState<{
      contents: RetrieveExampleFileContentsResult[];
      isComplete: boolean;
    }>({ contents: [], isComplete: false });

    useEffect(() => {
      if (exampleFiles === undefined) {
        setExampleFileContents({ contents: [], isComplete: false });
      }

      if (exampleFiles?.length === 0) {
        setExampleFileContents({ contents: [], isComplete: true });
      }
    }, [exampleFiles]);
    const results = useQueries({
      queries: (exampleFiles ?? [])
        .filter((exampleFile) => exampleFile && exampleFile.path)
        .map((exampleFile) => ({
          queryKey: ['get-example-file-content', exampleFile?.path],
          queryFn: () =>
            retrieveExampleFileContents(
              exampleFile?.path || '',
              exampleFile?.name || '',
              exampleInoPath,
            ),
          onSuccess: (data: RetrieveExampleFileContentsResult): void => {
            setExampleFileContents((prev) => {
              const contents = [
                ...prev.contents.filter(
                  (f) =>
                    f.path !== data.path &&
                    f.exampleInoPath === data.exampleInoPath,
                ),
                data,
              ];
              return {
                contents,
                isComplete: exampleFiles?.length === contents.length,
              };
            });
            onSuccess && onSuccess(data);
          },
          refetchOnWindowFocus: false,
          enabled,
        })),
    });

    const refetchAll = useCallback(() => {
      results.forEach((result) => result.refetch());
    }, [results]);

    return {
      exampleFileContents: exampleFileContents.contents,
      allContentsRetrieved: exampleFileContents.isComplete,
      refetchAll,
    };
  };

export const useRetrieveLibraryFilesContents: UseRetrieveLibraryFileContents =
  function (
    enabled,
    library?,
    onAllSuccess?,
  ): ReturnType<UseRetrieveLibraryFileContents> {
    const [libraryFilesContents, setLibraryFilesContents] = useState<
      RetrieveLibraryFileContentsResult[]
    >([]);

    useEffect(() => {
      if (library?.files === undefined) {
        setLibraryFilesContents([]);
      }
    }, [library?.files]);

    const { isLoading } = useQuery({
      queryKey: ['get-library-files-contents', library?.path],
      queryFn: () =>
        Promise.all(
          (library?.files ?? []).map((libraryFile) =>
            retrieveLibraryFileContents(libraryFile.path, libraryFile.name),
          ),
        ),
      onSuccess: (data: RetrieveLibraryFileContentsResult[]): void => {
        setLibraryFilesContents(data);
        onAllSuccess && onAllSuccess(data);
      },
      refetchOnWindowFocus: false,
      enabled,
    });

    return {
      isLoading,
      libraryFilesContents:
        libraryFilesContents.length > 0 ? libraryFilesContents : undefined,
    };
  };

export function getExamplesByFolder(examples: Example[]): ExamplesFolder[] {
  const root: ExamplesFolder[] = [];

  const ensureFolder = (
    list: ExamplesFolder[],
    name: string,
  ): ExamplesFolder => {
    const idx = list.findIndex((f) => f.name === name);
    if (idx >= 0) return list[idx];
    const f: ExamplesFolder = { name, examples: [], examplesNumber: 0 };
    list.push(f);
    return f;
  };

  examples.forEach((ex) => {
    const segments = (ex?.path ?? '').split('/').filter(Boolean);
    const folderSegments = segments.slice(0, -1);

    if (folderSegments.length === 0) {
      const f = ensureFolder(root, '');
      f.examplesNumber++;
      f.examples.push(ex);
      return;
    }

    let cursor = root;
    folderSegments.forEach((seg, i) => {
      const folder = ensureFolder(cursor, seg);
      folder.examplesNumber++;
      if (i < folderSegments.length - 1) {
        cursor = folder.examples as unknown as ExamplesFolder[];
      } else {
        folder.examples.push(ex);
      }
    });
  });

  const sortItems = <T extends { name: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const sortFolders = (folders: ExamplesFolder[]): ExamplesFolder[] => {
    const sorted = sortItems(folders);
    sorted.forEach((f) => (f.examples = sortItems(f.examples)));
    return sorted;
  };

  return sortFolders(root);
}
const toReleaseId = (id: string, version?: string) =>
  id.includes('@') ? id : version ? `${id}@${version}` : id;

export async function downloadLibrary(
  id: string,
  version?: string,
): Promise<void> {
  const releaseId = toReleaseId(id, version);

  const details = await getLibrary({ id: releaseId });

  const directUrl = details.downloadUrl;

  if (!directUrl) {
    throw new Error('error: download failed');
  }
  const link = document.createElement('a');
  link.href = directUrl;
  link.download = '';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

type UseGetCreatedSketchCompilation = (
  bypass: boolean,
  uploadCommand: (options?: BaseUploadCommandOptions) => Promise<void>,
  verifyCommand: (
    existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => Promise<void>,
  selectedFqbn?: string,
  initialSketchData?: SketchData,
) => {
  cachedCompileIsLoading: boolean;
};

export const useCachedSketchCompilation: UseGetCreatedSketchCompilation =
  function (
    bypass: boolean,
    uploadCommand: (options?: BaseUploadCommandOptions) => Promise<void>,
    verifyCommand: (
      existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
    ) => Promise<void>,
    selectedFqbn?: string,
    initialSketchData?: SketchData,
  ): ReturnType<UseGetCreatedSketchCompilation> {
    const {
      id: compilationId,
      type: commandType,
      fqbn,
      deleteCompilationData,
    } = useCacheCompile();

    const cachedDataIsComplete = !!compilationId && !!commandType && !!fqbn;

    useEffect(() => {
      if (
        (initialSketchData &&
          !initialSketchData.fqbn &&
          !initialSketchData.thingId) ||
        (selectedFqbn && fqbn && selectedFqbn !== fqbn)
      ) {
        deleteCompilationData();
      }
    }, [deleteCompilationData, fqbn, initialSketchData, selectedFqbn]);

    const { isLoading } = useQuery(
      ['get-create-sketch-compilation', compilationId, compileDataWasStored],
      () => {
        if (compileDataWasStored) {
          return Promise.resolve({ status: 'noop' });
        }

        return compilationId
          ? getCreatedSketchCompilation(compilationId)
          : Promise.reject(
              new Error('No sketch ID provided on session storage.'),
            );
      },
      {
        enabled:
          !compileDataWasStored &&
          cachedDataIsComplete &&
          fqbn === selectedFqbn &&
          !bypass,
        refetchOnWindowFocus: false,
        onSuccess(
          data:
            | ArduinoBuilderV2CompilationsResponse_BuilderApi
            | {
                status: 'noop';
              },
        ) {
          if (
            data.status === 'noop' ||
            data.status === 'failed' ||
            data.status === 'cancelled'
          )
            return;

          if (commandType === 'upload') {
            uploadCommand({ existingCompilation: data });
          }

          if (commandType === 'verify') {
            verifyCommand(data);
          }

          deleteCompilationData();
        },
      },
    );

    return {
      cachedCompileIsLoading:
        !!(compilationId && isLoading) && !compileDataWasStored,
    };
  };
