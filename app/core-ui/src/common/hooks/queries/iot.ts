import {
  abortPendingOtaById,
  checkThingCert,
  CompileSketch_Result,
  createOtaUpload,
  ga4Emitter,
  getBoardByFqbn,
  getCompilationOutput,
  getIotCloudDevices,
  GetIotCloudDevices_Result,
  getOtaById,
  GetSketchResult,
  getThingDevice,
  iotUploadReady,
  listDeviceOTA,
  NotificationMode,
  NotificationType,
  sendNotification,
  UploadIotSketchNotReadyError,
  UploadIotSketchReady_Result,
} from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderBoardv3Full_BuilderApi,
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  CheckThingCert_Response,
  CreateOtaV1_Response,
  ListOtaV1_Response,
  ShowDeviceV2_Response,
  ShowOtaV1_Response,
  ShowThingV1Device_Response,
} from '@cloud-editor-mono/infrastructure';
import {
  DetectedDevice,
  DetectedDevicesGroup,
  IotDevicesGroups,
  IotPortName,
  ToastSize,
  ToastType,
  useI18n,
} from '@cloud-editor-mono/ui-components';
import {
  QueryObserverResult,
  UseMutateAsyncFunction,
  UseMutateFunction,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageDescriptor } from 'react-intl';
import { WretchError } from 'wretch/types';

import { CommandParams } from '../../../cloud-editor/features/main/main.type';
import { createUpdatedCompilePayload } from '../../../cloud-editor/features/main/utils';
import { useGetBoardByFqbn, useVerifySketch } from './builder';
import { CompilePayload } from './builder.type';
import { refreshFilesContents, refreshSketch } from './create';
import {
  IotUploadOutput,
  IotUploadPayload,
  UseIoTSketch,
  UseIotUpload,
} from './iot.type';
import { useIotUploadData } from './iotUtils';
import { messages } from './messages';
import { formatTimestamp } from './utils/timestamps';

export type ShowThingV1Device_ResponseWithArchAndOriginalName =
  ShowThingV1Device_Response & {
    architecture: string;
    originalName?: string; // presence of this property shows that `.name` was modified
  };

export const useIotSketch: UseIoTSketch = function (
  isReadOnly: boolean,
  sketchData?: GetSketchResult,
): ReturnType<UseIoTSketch> {
  const [thingDeviceDetails, setThingDeviceDetails] =
    useState<ShowThingV1Device_ResponseWithArchAndOriginalName>();
  const [iotDevicesGroups, setIotDevicesGroups] = useState<IotDevicesGroups>();
  const isIotSketch = Boolean(sketchData?.thingId);

  const queryClient = useQueryClient();

  const thingDeviceDetailsQueryKey = useMemo(
    () => ['get-thing-device-details', sketchData?.thingId],
    [sketchData?.thingId],
  );

  const {
    data: thingDevice,
    isLoading: thingDeviceIsLoading,
    isError: thingDeviceNotFound,
  } = useQuery(
    thingDeviceDetailsQueryKey,
    () => {
      if (!sketchData?.thingId) {
        return Promise.reject('No thingId provided for Thing device');
      }

      try {
        return getThingDevice(sketchData.thingId);
      } catch (err) {
        return undefined;
      }
    },
    {
      refetchOnWindowFocus: false,
      enabled: isIotSketch,
    },
  );

  const refreshThingDeviceDetails = useCallback((): void => {
    queryClient.invalidateQueries(thingDeviceDetailsQueryKey);
    queryClient.invalidateQueries(['get-iot-cloud-devices']);
  }, [queryClient, thingDeviceDetailsQueryKey]);

  const {
    board: thingDeviceDetailsWithArch,
    isLoading: thingDeviceArchIsLoading,
  } = useGetBoardByFqbn(Boolean(thingDevice), thingDevice?.fqbn);

  useEffect(() => {
    if (!thingDevice || !thingDeviceDetailsWithArch) return;

    setThingDeviceDetails({
      ...thingDevice,
      name:
        thingDevice.name !== thingDeviceDetailsWithArch.name
          ? `${thingDevice.name} - ${thingDeviceDetailsWithArch.name}`
          : thingDevice.name,
      architecture: thingDeviceDetailsWithArch.architecture,
      originalName: thingDevice.name,
    });
  }, [thingDevice, thingDeviceDetailsWithArch]);

  const thingDeviceDetailsIsLoading =
    isIotSketch &&
    (thingDeviceIsLoading || thingDeviceArchIsLoading || !thingDeviceDetails);

  const iotDevicesToEnrich = useMemo(
    () =>
      iotDevicesGroups && [
        ...new Set(
          [
            ...iotDevicesGroups[DetectedDevicesGroup.Online],
            ...iotDevicesGroups[DetectedDevicesGroup.Offline],
          ]
            // ** we only need to fetch details for devices that are missing
            // ** architecture or a board name suffix
            .filter((d) => !d.architecture || !d.originalName)
            .map((d) => ({ fqbn: d.fqbn, name: d.name })),
        ),
      ],
    [iotDevicesGroups],
  );

  const fqbnQueries = useQueries({
    queries: (iotDevicesToEnrich ?? []).map(({ fqbn: deviceFqbn, name }) => ({
      refetchOnWindowFocus: false,
      queryKey: ['get-board-by-fqbn', deviceFqbn, name],
      queryFn: () =>
        deviceFqbn
          ? getBoardByFqbn({ fqbn: deviceFqbn })
          : Promise.reject('No FQBN provided for IoT device'),
      onSuccess: (data: ArduinoBuilderBoardv3Full_BuilderApi): void => {
        setIotDevicesGroups((prev) => {
          if (!prev) return prev;

          const mapNameAndArchToDevice = (
            d: DetectedDevice,
          ): DetectedDevice => {
            if (d.fqbn !== data.fqbn) return d;

            return {
              ...d,
              name: d.name !== data.name ? `${d.name} - ${data.name}` : d.name,
              architecture: data.architecture,
              originalName: d.name,
            };
          };

          const updatedOnlineDevices = prev[DetectedDevicesGroup.Online].map(
            mapNameAndArchToDevice,
          );

          const updatedOfflineDevices = prev[DetectedDevicesGroup.Offline].map(
            mapNameAndArchToDevice,
          );

          return {
            [DetectedDevicesGroup.Online]: updatedOnlineDevices,
            [DetectedDevicesGroup.Offline]: updatedOfflineDevices,
          };
        });
      },
    })),
  });

  useQuery(
    ['get-iot-cloud-devices'],
    () => getIotCloudDevices(sketchData?.thingId),
    {
      refetchOnWindowFocus: false,
      staleTime: 0,
      refetchInterval: 1500,
      isDataEqual: (prev, next) => {
        if (!prev) return false;

        const mapToIdAndSort = (devices: ShowDeviceV2_Response[]): string[] => {
          return devices.map((d) => `${d.id}-${d.name}`).sort();
        };

        const prevOnlineIds = mapToIdAndSort(prev[DetectedDevicesGroup.Online]);
        const prevOfflineIds = mapToIdAndSort(
          prev[DetectedDevicesGroup.Offline],
        );

        const nextOnlineIds = mapToIdAndSort(next[DetectedDevicesGroup.Online]);
        const nextOfflineIds = mapToIdAndSort(
          next[DetectedDevicesGroup.Offline],
        );

        const onlineDevicesEqual =
          JSON.stringify(prevOnlineIds) === JSON.stringify(nextOnlineIds);

        const offlineDevicesEqual =
          JSON.stringify(prevOfflineIds) === JSON.stringify(nextOfflineIds);

        return onlineDevicesEqual && offlineDevicesEqual;
      },
      // ** here (in `isDataEqual`, `notifyOnChangeProps` and in `onSuccess`) we prevent rerenders/state changes
      // ** when devices are the same in terms of id-name and online/offline status, this hook is NOT sensitive to other changes
      // ** in IoT device props
      notifyOnChangeProps: ['data'],
      enabled:
        !isReadOnly &&
        isIotSketch &&
        (fqbnQueries.length === 0 || fqbnQueries.every((r) => !r.isLoading)), // avoids race condition with fqbn useQueries
      onSuccess: (data: GetIotCloudDevices_Result) => {
        const createMapOtaDevice = (port: IotPortName) =>
          function mapOtaDevice(d: ShowDeviceV2_Response): DetectedDevice {
            const portBoardId = createIotPortBoardID(port, d.id);

            return {
              id: d.id,
              portBoardId,
              name: d.name,
              fqbn: d.fqbn,
              portName: port,
              isUnknownBoard: false,
              isAssociated: false,
              isIot: true,
              serialNumber: d.serial,
              otaCompatible: d.otaCompatible,
            };
          };

        const onlineDevicesMapped = data[DetectedDevicesGroup.Online].map(
          createMapOtaDevice(IotPortName.Online),
        );
        const offlineDevicesMapped = data[DetectedDevicesGroup.Offline].map(
          createMapOtaDevice(IotPortName.Offline),
        );

        const mappedDevices = [...onlineDevicesMapped, ...offlineDevicesMapped];

        const deviceIdsKey = JSON.stringify(
          mappedDevices
            .map((d) => `${d.portBoardId}-${d.originalName || d.name}`)
            .sort(),
        );

        setIotDevicesGroups((prev) => {
          const prevDevices = prev && [
            ...prev[DetectedDevicesGroup.Online],
            ...prev[DetectedDevicesGroup.Offline],
          ];

          const previousDeviceIdsKey = JSON.stringify(
            prevDevices
              ?.map((d) => `${d.portBoardId}-${d.originalName || d.name}`)
              .sort(),
          );

          const devicesUnchanged = deviceIdsKey === previousDeviceIdsKey;
          if (devicesUnchanged) return prev;

          const mapNameAndArchToDevice = (
            d: DetectedDevice,
          ): DetectedDevice => {
            const prevMappedDevice = prevDevices?.find(
              (pd) => pd.portBoardId === d.portBoardId,
            );

            const prevMappedArch = prevMappedDevice?.architecture;
            const prevMappedDeviceName = prevMappedDevice?.name;
            const prevMappedDeviceOriginalName = prevMappedDevice?.originalName;

            const nameAlreadySuffixed =
              prevMappedDeviceOriginalName &&
              prevMappedDeviceOriginalName === d.name;

            return {
              ...d,
              name: nameAlreadySuffixed
                ? prevMappedDeviceName ?? d.name
                : d.name,
              architecture: prevMappedArch ?? d.architecture,
              originalName: nameAlreadySuffixed
                ? prevMappedDeviceOriginalName
                : undefined,
              // ** if the name has changes backend, set this to undefined, to recreate board name suffix
              // ** in `fqbnQueries`
            };
          };

          const onlineDevices = onlineDevicesMapped.map(mapNameAndArchToDevice);
          const offlineDevices = offlineDevicesMapped.map(
            mapNameAndArchToDevice,
          );

          return {
            [DetectedDevicesGroup.Online]: onlineDevices,
            [DetectedDevicesGroup.Offline]: offlineDevices,
          };
        });
      },
    },
  );

  useEffect(() => {
    if (!thingDeviceDetails || !iotDevicesGroups) return;

    const iotDevices = [
      ...iotDevicesGroups[DetectedDevicesGroup.Online],
      ...iotDevicesGroups[DetectedDevicesGroup.Offline],
    ];

    const matchingIotDevice = iotDevices.find(
      (d) => d.id === thingDeviceDetails.id,
    );

    if (!matchingIotDevice) return;

    if (
      thingDeviceDetails.originalName &&
      matchingIotDevice.originalName &&
      thingDeviceDetails.originalName !== matchingIotDevice.originalName
    ) {
      queryClient.invalidateQueries({
        queryKey: thingDeviceDetailsQueryKey,
        exact: true,
      });
    }
  }, [
    iotDevicesGroups,
    queryClient,
    sketchData,
    thingDeviceDetails,
    thingDeviceDetailsQueryKey,
    thingDeviceDetailsWithArch,
  ]);

  return {
    isIotSketch,
    iotDevicesGroups,
    thingDeviceDetails,
    thingDeviceDetailsIsLoading,
    thingDeviceNotFound,
    refreshThingDeviceDetails,
  };
};

export function createIotPortBoardID(
  portName: IotPortName,
  id: string,
): string {
  return `${portName}-${id}`;
}

export type UseIotUploadQueries = (
  isUploading: boolean,
  thingDeviceDetailsIsLoading: boolean,
  verboseCompile: boolean,
  setOutput: React.Dispatch<React.SetStateAction<IotUploadOutput | undefined>>,
  normalizeOutput: (data: CompileSketch_Result) => void,
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>,
  setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  createCompilation: (payload: CompilePayload) => void,
  thingId?: string,
  selectedIoTDeviceId?: string,
  commandParams?: CommandParams,
  enableGetOutput?: boolean,
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
) => {
  shouldCheckForOngoingOta: boolean;
  checkOngoingOta: () => Promise<
    QueryObserverResult<ListOtaV1_Response, unknown>
  >;
  startIotUpload: () => Promise<
    QueryObserverResult<UploadIotSketchReady_Result, unknown>
  >;
  newOtaUpload: UseMutateAsyncFunction<
    | CreateOtaV1_Response
    | {
        errStatus: number;
      },
    unknown,
    IotUploadPayload,
    unknown
  >;
  resetUpload: () => void;
  isCreating: boolean;
  uploadHasError: boolean;
  abortPending: UseMutateFunction<CreateOtaV1_Response, unknown, void, unknown>;
  clearOtaState: () => void;
  isFetchingCompilationOutput: boolean;
  otaProgressData?: ShowOtaV1_Response;
};

export const useIotUploadQueries: UseIotUploadQueries = function (
  isUploading: boolean,
  thingDeviceDetailsIsLoading: boolean,
  verboseCompile: boolean,
  setOutput: React.Dispatch<React.SetStateAction<IotUploadOutput | undefined>>,
  normalizeOutput: (data: CompileSketch_Result) => void,
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>,
  setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  createCompilation: (payload: CompilePayload) => void,
  thingId?: string,
  selectedIoTDeviceId?: string,
  commandParams?: CommandParams,
  enableGetOutput?: boolean,
  createdSketchCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
): ReturnType<UseIotUploadQueries> {
  const { formatMessage } = useI18n();

  const [otaId, setOtaId] = useState<string>();
  const [hasCheckedForOngoingOta, setHasCheckedForOngoingOta] = useState(false);

  const shouldCheckForOngoingOta =
    thingDeviceDetailsIsLoading ||
    Boolean(selectedIoTDeviceId && !hasCheckedForOngoingOta);

  const { refetch: checkOngoingOta } = useQuery(
    ['check-iot-in-progress', selectedIoTDeviceId],
    () => {
      return selectedIoTDeviceId
        ? listDeviceOTA(selectedIoTDeviceId, {
            limit: 1,
            order: 'desc',
          })
        : Promise.reject('Cannot fetch IOT request from DB');
    },
    {
      onSuccess: async (data: ListOtaV1_Response) => {
        if (!data.ota?.length) {
          setHasCheckedForOngoingOta(true);
          return;
        }

        if (data.ota[0].status === 'in_progress') {
          //Set the ID
          setOtaId(data.ota[0].id);
          setUploading(true);

          setHasCheckedForOngoingOta(true);

          return;
        }

        if (data.ota[0].status === 'pending') {
          setIsPending(true);
          setOtaId(data.ota[0].id);
          setUploading(true);

          setHasCheckedForOngoingOta(true);

          return;
        }

        setHasCheckedForOngoingOta(true);
      },
      enabled: !!selectedIoTDeviceId && shouldCheckForOngoingOta,
    },
  );

  const { data: iotUploadIsReady, refetch: startIotUpload } = useQuery(
    ['iot-sketch-is-ready', thingId, selectedIoTDeviceId, commandParams],
    () => {
      return thingId && selectedIoTDeviceId
        ? iotUploadReady(thingId, selectedIoTDeviceId)
        : Promise.reject(
            'Cannot assert IoT upload readiness. No thingId or deviceId provided.',
          );
    },
    {
      onError: () => {
        const msg = formatMessage(messages.iotUploadFailedUnknownIfReady);
        setOutput({
          stage: 'precompile',
          output: msg,
          stderr: msg,
          hasFailed: true,
        });
      },
      onSuccess: async (data: UploadIotSketchReady_Result) => {
        if (data.value === false) {
          const msg = formatMessage(getIotUploadNotReadyMsg(data));
          setOutput({
            stage: 'precompile',
            output: msg,
            stderr: msg,
            hasFailed: true,
          });

          return;
        }

        setOutput({
          stage: 'precompile',
          output: '',
          stdout: '',
          hasFailed: false,
        });

        if (!commandParams) return;

        const updatedCompilePayload = createUpdatedCompilePayload({
          fqbn: commandParams.selectedFqbn,
          sketchData: commandParams.initialSketchData,
          mainInoData: commandParams.initialInoData,
          isVerboseOutput: verboseCompile,
          filesData: commandParams.initialFilesData,
          isIot: true,
        });

        updatedCompilePayload.commandType = 'upload';
        updatedCompilePayload.shouldCache =
          !!commandParams.initialSketchData.fqbn || !!thingId;

        createCompilation(updatedCompilePayload);

        ga4Emitter({
          type: 'COMPILE',
          payload: { sketch_id: commandParams.initialSketchData.id },
        });
      },
      refetchOnWindowFocus: false,
      enabled: false,
    },
  );

  const onUploadError = useCallback(() => {
    (): void => {
      const msg = formatMessage(messages.iotUploadRequestUnsuccessful);
      setOutput((prev) => ({
        ...prev,
        stage: 'upload',
        output: `${prev?.output ? `${prev.output}\n` : ''}${msg}`,
        stderr: `${prev?.stderr ? `${prev.stderr}\n` : ''}${msg}`,
        hasFailed: true,
      }));

      setIsPending(false);
    };
  }, [formatMessage, setIsPending, setOutput]);

  const {
    data: otaUploadData,
    isLoading: isCreating,
    reset: resetUpload,
    isError: uploadHasError,
    mutateAsync: newOtaUpload,
  } = useMutation({
    mutationKey: ['new-ota', iotUploadIsReady?.value],
    mutationFn: (payload: IotUploadPayload) => {
      return iotUploadIsReady?.value
        ? createOtaUpload(payload.deviceId, payload.binaryKey)
        : Promise.reject('Could not perform IoT upload, not ready.');
    },
    onError: onUploadError,
    onSuccess: (data: CreateOtaV1_Response | { errStatus: number }) => {
      if ('ota' in data) {
        const msg = formatMessage(messages.iotUploadRequestSuccessful);
        const timestamp = formatTimestamp(data.ota?.startedAt);
        setOutput((prev) => ({
          ...prev,
          stage: 'upload',
          output: `${
            prev?.output ? `${prev.output}\n` : ''
          }${timestamp} ${msg}`,
          stdout: `${
            prev?.stdout ? `${prev.stdout}\n` : ''
          }${timestamp} ${msg}`,
          hasFailed: false,
          otaStatus: data.ota?.status,
        }));

        //On success it sets OTA as pending
        setIsPending(true);
        setUploading(true);
        return;
      }

      if ('errStatus' in data) {
        if (data.errStatus === 409) {
          //409 Conflict means an Ota is already create, so we need to load it.
          checkOngoingOta();
          return;
        }
      }

      const msg = formatMessage(messages.iotUploadFailed);
      setOutput((prev) => ({
        ...prev,
        stage: 'upload',
        output: `${prev?.output ? `${prev.output}\n` : ''}${msg}`,
        stderr: `${prev?.stderr ? `${prev.stderr}\n` : ''}${msg}`,
        hasFailed: true,
        otaStatus: 'failed',
      }));
    },
  });

  const otaUploadReady = Boolean(otaUploadData || otaId);
  const currentOtaId =
    (otaUploadData && 'ota' in otaUploadData && otaUploadData?.ota?.id) ||
    otaId;

  const { mutate: abortPending, isLoading: isAborting } = useMutation({
    mutationKey: ['abort-pending-iot-upload', currentOtaId],
    mutationFn: () => {
      return currentOtaId
        ? abortPendingOtaById(currentOtaId)
        : Promise.reject('No ID provided to abort pending OTA');
    },
    onSuccess(data) {
      let msg: string;

      if (data) {
        msg = formatMessage(messages.iotUploadAborted);
        const timestamp = formatTimestamp(data.ota?.endedAt);

        setOutput((prev) => ({
          ...prev,
          stage: 'upload',
          output: `${
            prev?.output ? `${prev.output}\n` : ''
          }${timestamp} ${msg}`,
          stdout: `${
            prev?.stdout ? `${prev.stdout}\n` : ''
          }${timestamp} ${msg}`,
          hasFailed: true,
          otaStatus: 'failed',
        }));
        setUploading(false);
        setIsPending(false);
        return;
      }
    },
    onError(error) {
      if (error && ((error as Error).cause as WretchError).status === 409) {
        return sendNotification({
          message: formatMessage(messages.notificationPendingFailed),
          mode: NotificationMode.Toast,
          type: NotificationType.Change,
          modeOptions: {
            toastType: ToastType.Passive,
            toastSize: ToastSize.Small,
          },
        });
      }

      sendNotification({
        message: formatMessage(messages.notificationFailed),
        mode: NotificationMode.Toast,
        type: NotificationType.Change,
        modeOptions: {
          toastType: ToastType.Passive,
          toastSize: ToastSize.Small,
        },
      });
    },
  });

  const { data: otaProgressData } = useQuery({
    queryKey: ['get-ota-progress', currentOtaId],
    queryFn: () => {
      return currentOtaId
        ? getOtaById(currentOtaId, { all_progress: true })
        : Promise.reject('No OTA ID provided.');
    },
    enabled: otaUploadReady && !!currentOtaId && isUploading && !isAborting,
    refetchInterval: (data) => (data?.ota?.status === 'pending' ? 1000 : 1500),
  });

  const clearOtaState = useCallback(() => {
    setOtaId(undefined);
    setIsPending(false);
    setUploading(false);
  }, [setIsPending, setUploading]);

  const verifyIoTSketchOnSuccess = useCallback(
    (data: CompileSketch_Result) => {
      normalizeOutput(data);
      if (selectedIoTDeviceId && data.otaKey && !data.failed) {
        newOtaUpload({
          deviceId: selectedIoTDeviceId,
          binaryKey: data.otaKey,
        });

        ga4Emitter({
          type: 'UPLOAD',
          payload: { sketch_id: commandParams?.initialSketchData.id || '' },
        });
      }
    },
    [
      commandParams?.initialSketchData.id,
      newOtaUpload,
      normalizeOutput,
      selectedIoTDeviceId,
    ],
  );

  // On getCompilationOutput, BE responds with extra_files on builderV2 instead of files like builderV1. On the function we modify the response
  const { isFetching: isFetchingCompilationOutput } = useQuery(
    ['get-compilation-output', createdSketchCompilation?.id],
    () =>
      createdSketchCompilation?.id
        ? getCompilationOutput(createdSketchCompilation?.id)
        : Promise.reject(new Error('No sketch ID provided')),
    {
      onSuccess: verifyIoTSketchOnSuccess,
      enabled: !!createdSketchCompilation?.id && enableGetOutput,
    },
  );

  return {
    shouldCheckForOngoingOta,
    checkOngoingOta,
    startIotUpload,
    newOtaUpload,
    resetUpload,
    isCreating,
    uploadHasError,
    abortPending,
    clearOtaState,
    isFetchingCompilationOutput,
    otaProgressData,
  };
};

export const useIotUpload: UseIotUpload = function (
  verboseCompile: boolean,
  thingDeviceDetailsIsLoading: boolean,
  commandParams?: CommandParams,
  selectedIoTDeviceId?: string,
  thingId?: string,
): ReturnType<UseIotUpload> {
  const [output, setOutput] = useState<IotUploadOutput>();

  const [isPending, setIsPending] = useState<boolean>(false);
  const [isUploading, setUploading] = useState<boolean>(false);

  const normalizeOutput = useCallback((data: CompileSketch_Result): void => {
    const {
      output: compileOutput,
      stderr: _stderr,
      stdout: _stdout,
      failed,
      warnLineEnd,
      warnLineStart,
      outputLineEnd,
      settled,
    } = data;
    if (!compileOutput) return;

    const newLineRegEx = /\r\n|\r|\n/;
    setOutput((prev) => {
      // if prev stage was 'precompile', assign the prev strings vars here, and
      // then props in the output obj for concatenation with compile logs in subsequent
      // executions of this function.
      const prevStageWasPrecompile = prev?.stage === 'precompile';
      const preCompileOutput =
        prevStageWasPrecompile && prev.output ? prev.output : undefined;
      const preCompileStdout =
        prevStageWasPrecompile && prev.stdout ? prev.stdout : undefined;
      const preCompileStderr =
        prevStageWasPrecompile && prev.stderr ? prev.stderr : undefined;

      // Below we use the settled var to avoid calculating line counts if
      // compilation is not settled, the related props are not used
      // until after compile is complete.
      const preCompileOutputLines =
        settled && prev?.preCompileOutput
          ? prev?.preCompileOutput.split(newLineRegEx).length
          : 0;

      const stdout = settled
        ? _stdout &&
          `${
            prev?.preCompileStdout ? `${prev?.preCompileStdout}\n` : ''
          }${_stdout}`
        : prev?.stdout;

      const stderr = settled
        ? _stderr &&
          `${
            prev?.preCompileStderr ? `${prev?.preCompileStderr}\n` : ''
          }${_stderr}`
        : prev?.stderr;

      const preCompileOutputWithNewLine =
        prevStageWasPrecompile && preCompileOutput ? `${prev.output}\n` : '';

      return {
        stage: 'compile',
        output: `${preCompileOutputWithNewLine}${compileOutput}`,
        preCompileOutput,
        stdout,
        preCompileStdout,
        stderr,
        preCompileStderr,
        warnLineStart: warnLineStart
          ? warnLineStart + preCompileOutputLines
          : warnLineStart,
        warnLineEnd: warnLineEnd
          ? warnLineEnd + preCompileOutputLines
          : warnLineEnd,
        compileOutputLineEnd: outputLineEnd
          ? outputLineEnd + preCompileOutputLines
          : outputLineEnd,
        hasFailed: failed,
      };
    });
  }, []);

  const {
    isVerifying,
    reset: resetVerify,
    compileSketchResponseData,
    createdSketchCompilation,
    compileProgress,
    createCompilation,
    compileResultMessages,
    errorFiles,
  } = useVerifySketch();

  const {
    startIotUpload,
    isCreating,
    resetUpload,
    uploadHasError,
    abortPending,
    otaProgressData,
    clearOtaState,
    shouldCheckForOngoingOta,
    isFetchingCompilationOutput,
  } = useIotUploadQueries(
    isUploading,
    thingDeviceDetailsIsLoading,
    verboseCompile,
    setOutput,
    normalizeOutput,
    setIsPending,
    setUploading,
    createCompilation,
    thingId,
    selectedIoTDeviceId,
    commandParams,
    !isVerifying &&
      compileSketchResponseData?.settled &&
      !compileSketchResponseData?.failed,
    createdSketchCompilation,
  );

  useIotUploadData(setOutput, setIsPending, setUploading, otaProgressData);

  // On compileSketchResponse change update the output
  useEffect(() => {
    if (!compileSketchResponseData) return;
    normalizeOutput(compileSketchResponseData);
  }, [compileSketchResponseData, normalizeOutput]);

  return {
    startIotUpload,
    isVerifying,
    isUploading,
    isPending,
    abortPending,
    isCreating: isCreating || isFetchingCompilationOutput,
    uploadHasError,
    resetUpload,
    resetVerify,
    output,
    setOutput,
    compileErrors: compileSketchResponseData?.errors,
    clearOtaState,
    shouldCheckForOngoingOta,
    compileProgress,
    uploadOutputPostCompileLineStart: output?.compileOutputLineEnd
      ? output.compileOutputLineEnd + 1
      : undefined,
    compileResultMessages,
    errorFiles,
  };
};

function getIotUploadNotReadyMsg(iotUploadIsNotReady: {
  value: false;
  reason: UploadIotSketchNotReadyError;
}): MessageDescriptor {
  const iotUploadNotReadyReason =
    !iotUploadIsNotReady?.value && iotUploadIsNotReady?.reason;

  let message = messages.iotUploadFailed;
  if (!iotUploadNotReadyReason) return message;

  switch (iotUploadNotReadyReason) {
    case UploadIotSketchNotReadyError.UpdateRequired:
      message = messages.iotUploadNinaUpdateRequired;
      break;
    case UploadIotSketchNotReadyError.WrongDevice:
      message = messages.iotUploadWrongDevice;
      break;
    case UploadIotSketchNotReadyError.OTAUnavailable:
      message = messages.iotUploadOTAUnavailable;
      break;
    case UploadIotSketchNotReadyError.OTAIncompatible:
      message = messages.iotUploadOTAIncompatible;
      break;
  }

  return message;
}

type UseIotCertificateCheck = (
  uploadCommand: () => void,
  refreshThingDeviceDetails: () => void,
  thingId?: string,
  thingPropertiesPath?: string,
  thingSketchSecretsTS?: string,
  thingSketchFileContentTS?: string,
  bypassUpload?: boolean,
) => {
  checkThingCert: UseMutateFunction<
    CheckThingCert_Response,
    unknown,
    void,
    void
  >;
  cancel: () => void;
  isLoading: boolean;
  isMigrating: boolean;
};

export const useIotCertificateCheck: UseIotCertificateCheck = function (
  uploadCommand: () => void,
  refreshThingDeviceDetails: () => void,
  thingId?: string,
  thingPropertiesPath?: string,
  thingSketchSecretsTS?: string,
  thingSketchFileContentTS?: string,
  bypassUpload?: boolean,
): ReturnType<UseIotCertificateCheck> {
  const { formatMessage } = useI18n();

  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  const [secretsBeforeThingCertCheck, setSecretsBeforeThingCertCheck] =
    useState<string>();
  const [contentBeforeThingCertCheck, setContentBeforeThingCertCheck] =
    useState<string>();
  const [secretsAfterThingCertCheck, setSecretsAfterThingCertCheck] =
    useState<string>();
  const [contentAfterThingCertCheck, setContentAfterThingCertCheck] =
    useState<string>();

  const { mutate, reset, isLoading, isError, data } = useMutation({
    mutationKey: ['check-device-cert', thingId, thingPropertiesPath],
    onMutate: () => {
      setSecretsBeforeThingCertCheck(thingSketchSecretsTS);
      setContentBeforeThingCertCheck(thingSketchFileContentTS);
      setIsMigrating(true);
    },
    mutationFn: () => {
      return thingId && thingPropertiesPath
        ? checkThingCert(thingId)
        : Promise.reject('No thingId provided');
    },
    onSuccess: (data) => {
      const sketchRefreshRequired = data.requiredAction === 'RELOAD_SKETCH';
      if (sketchRefreshRequired) {
        refreshSketch();
        thingPropertiesPath && refreshFilesContents([thingPropertiesPath]);
      }
      refreshThingDeviceDetails();
    },
    onError: () => {
      sendNotification({
        message: formatMessage(messages.iotCertCheckFailed),
        mode: NotificationMode.Toast,
        type: NotificationType.Change,
        modeOptions: {
          toastType: ToastType.Passive,
          toastSize: ToastSize.Regular,
        },
      });
    },
  });

  const clearCertCheck = useCallback(() => {
    reset();
    setIsMigrating(false);
    setSecretsBeforeThingCertCheck(undefined);
    setContentBeforeThingCertCheck(undefined);
    setSecretsAfterThingCertCheck(undefined);
    setContentAfterThingCertCheck(undefined);
  }, [reset]);

  useEffect(() => {
    const sketchRefreshRequired = data?.requiredAction === 'RELOAD_SKETCH';
    if (sketchRefreshRequired && !isError) {
      setSecretsAfterThingCertCheck(thingSketchSecretsTS);
      setContentAfterThingCertCheck(thingSketchFileContentTS);
    }
  }, [data, isError, thingSketchFileContentTS, thingSketchSecretsTS]);

  useEffect(() => {
    if (isError) {
      clearCertCheck();
      return;
    }

    const opNotInProgress = !bypassUpload && !isLoading;

    const sketchRefreshWasNotTriggered = data?.requiredAction === 'NONE';

    const dataToCompareIsAvailable =
      secretsBeforeThingCertCheck &&
      contentBeforeThingCertCheck &&
      secretsAfterThingCertCheck &&
      contentAfterThingCertCheck;

    const secretsAndContentHaveChanged =
      secretsBeforeThingCertCheck !== secretsAfterThingCertCheck &&
      contentBeforeThingCertCheck !== contentAfterThingCertCheck;

    if (
      opNotInProgress &&
      data &&
      (sketchRefreshWasNotTriggered ||
        (dataToCompareIsAvailable && secretsAndContentHaveChanged))
    ) {
      clearCertCheck();
      uploadCommand();
    }
  }, [
    bypassUpload,
    clearCertCheck,
    contentAfterThingCertCheck,
    contentBeforeThingCertCheck,
    data,
    isError,
    isLoading,
    secretsAfterThingCertCheck,
    secretsBeforeThingCertCheck,
    uploadCommand,
  ]);

  return {
    checkThingCert: mutate,
    cancel: clearCertCheck,
    isLoading,
    isMigrating,
  };
};
