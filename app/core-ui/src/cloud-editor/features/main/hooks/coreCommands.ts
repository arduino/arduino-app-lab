import {
  codeSubjectNext,
  FileId,
  ga4Emitter,
  getCodeSubjectById,
  getUnsavedFilesSubject,
  getUnsavedFilesSubjectNext,
  isCodeChangeWithCtx,
  NotificationMode,
  NotificationType,
  RetrieveFileContentsResult,
  sendAnalyticsEvent,
  sendNotification,
} from '@cloud-editor-mono/domain';
import {
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  GetSketch_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import {
  ConsoleOutput,
  ConsolePanelStatus,
  Example,
  IsUploading,
  Preferences,
  ToastSize,
  ToastType,
} from '@cloud-editor-mono/ui-components';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IntlContext } from 'react-intl';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';

import { usePreferenceObservable } from '../../../../common/hooks/preferences';
import {
  useCachedSketchCompilation,
  useVerifySketch,
} from '../../../../common/hooks/queries/builder';
import { useAssociateSketchToDevice } from '../../../../common/hooks/queries/create';
import { SaveSketchFileMutation } from '../../../../common/hooks/queries/create.type';
import {
  useIotCertificateCheck,
  useIotUpload,
} from '../../../../common/hooks/queries/iot';
import { AuthContext } from '../../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../../common/providers/component/componentContext';
import { SerialCommunicationContext } from '../../../../common/providers/serial-communication/serialCommunicationContext';
import {
  BaseUploadCommandOptions,
  commandDataIsComplete,
  CommandParams,
  isCreatedSketch,
  UseBoardsConfig,
  UseCoreCommands,
} from '../main.type';
import { messages } from '../messages';
import { createUpdatedCompilePayload } from '../utils';
import { useSerialMonitorWindow } from './serialMonitorWindow';

const MIGRATE_IOT_CERT = false;
export const useCoreCommands: UseCoreCommands = function (
  isReadOnly: boolean,
  isExampleSketchRoute: boolean,
  isLibraryRoute: boolean,
  modifySketchData: (newData: Partial<SketchData>) => void,
  isIotSketch: boolean,
  selectedBoardIsIot: boolean,
  saveSketchFileQuery: SaveSketchFileMutation,
  addGenericBypassAutoSelection: ReturnType<UseBoardsConfig>['addGenericBypassAutoSelection'],
  thingDeviceDetailsIsLoading: boolean,
  allContentsRetrieved: boolean,
  refreshThingDeviceDetails: () => void,
  initialInoData?: RetrieveFileContentsResult,
  initialSketchData?: GetSketch_Response | Example,
  initialFilesData?: RetrieveFileContentsResult[],
  selectedFqbn?: string,
  selectedBoard?: string,
  selectedPort?: string,
  selectedIoTDeviceId?: string,
): ReturnType<UseCoreCommands> {
  const { compileUsageExceeded } = useContext(AuthContext);

  // This flag covers the time between cert check and verify commencement.
  // When it's truthy is elicits: "verifying" UI status
  const [waitingForCompilePostCertCheck, setWaitingForCompilePostCertCheck] =
    useState<boolean>(false);

  const compileErrorsTimestamp = useRef<number>();

  const saveOnVerifyAndUpload = Boolean(
    usePreferenceObservable(Preferences.SaveOnVerifyingUploading),
  );
  const consoleOutput = String(
    usePreferenceObservable(Preferences.ConsoleOutput),
  );
  const [isUploading, setIsUploading] = useState<IsUploading>({ value: false });

  const unsavedFileIds = useObservable(
    getUnsavedFilesSubject<Subject<Set<FileId>>>(),
  );

  const saveAllFiles = useCallback(() => {
    if (isReadOnly) return;
    if (isExampleSketchRoute) return;

    if (unsavedFileIds) {
      unsavedFileIds.forEach(async (fileId: string) => {
        const subject$ = getCodeSubjectById(fileId).getValue();

        const code = subject$?.value;
        const hash = subject$?.meta.hash;

        try {
          const res = await saveSketchFileQuery({ code, fileId, hash });
          if (!res || 'errStatus' in res) return;

          if (isCodeChangeWithCtx(subject$)) {
            codeSubjectNext(
              fileId,
              code,
              subject$.context.saveCode,
              undefined,
              false,
              res?.hash,
            );
          }
          getUnsavedFilesSubjectNext(fileId, false);
        } catch (error) {
          console.error(error);
        }
      });
    }
  }, [isReadOnly, isExampleSketchRoute, unsavedFileIds, saveSketchFileQuery]);

  const {
    upload,
    uploadStream,
    clearUploadStream,
    uploadIsCompiling,
    uploadIsComputing,
    uploadIsUploading,
    uploadCompilingProgress,
    compileErrors: uploadCompileErrors,
    compileHasFailed: uploadCompileHasFailed,
    compileWarnLineStart: uploadCompileWarnLineStart,
    compileWarnLineEnd: uploadCompileWarnLineEnd,
    uploadHasError,
    uploadOutputLineStart,
    compileResultMessages: uploadCompileResultMessages,
    errorFiles: uploadErrorFiles,
  } = useContext(SerialCommunicationContext);
  const getUploadString = useCallback((): string | undefined => {
    let currentValue;

    uploadStream
      .subscribe((value) => {
        currentValue = value;
      })
      .unsubscribe();
    return currentValue;
  }, [uploadStream]);

  const commandParams: CommandParams = useMemo(() => {
    if (
      !initialSketchData ||
      !initialInoData ||
      !selectedFqbn ||
      !allContentsRetrieved
    )
      return;

    const commandData = {
      initialInoData,
      initialSketchData,
      initialFilesData,
    };

    if (!commandDataIsComplete(commandData)) return;
    return {
      ...commandData,
      selectedFqbn,
    };
  }, [
    allContentsRetrieved,
    initialFilesData,
    initialInoData,
    initialSketchData,
    selectedFqbn,
  ]);

  const {
    startIotUpload,
    isUploading: isIotUploading,
    uploadHasError: iotUploadHasError,
    resetUpload: resetIotUpload,
    abortPending: iotAbortPending,
    resetVerify: resetIotSketchVerify,
    isVerifying: isVerifyingForIotUpload,
    isPending: isPendingIot,
    isCreating: isCreatingIot,
    output: iotUploadOutput,
    setOutput: setIotUploadOutput,
    compileErrors: iotCompileErrors,
    shouldCheckForOngoingOta,
    clearOtaState,
    compileProgress: iotCompileProgress,
    uploadOutputPostCompileLineStart: iotUploadOutputPostCompileLineStart,
    compileResultMessages: iotCompileResultMessages,
    errorFiles: iotErrorFiles,
  } = useIotUpload(
    consoleOutput === ConsoleOutput.Verbose,
    thingDeviceDetailsIsLoading,
    commandParams,
    selectedIoTDeviceId,
    isCreatedSketch(initialSketchData) ? initialSketchData.thingId : undefined,
  );

  const {
    isVerifying,
    compileHasFailed,
    compileSketchResponseData,
    reset: resetVerify,
    createCompilation,
    compileProgress,
    continuePreviousCompilationById,
    compileResultMessages,
    errorFiles,
  } = useVerifySketch();

  const { preVerify } = useContext(ComponentContext);
  const { formatMessage } = useContext(IntlContext);

  const { mutateSketchWithDevice, isLoading: mutateSketchWithDeviceIsLoading } =
    useAssociateSketchToDevice();

  const uploadCommandCleanup = useCallback(() => {
    clearUploadStream();
    setIotUploadOutput(undefined);
    clearOtaState();

    resetIotUpload();
    resetIotSketchVerify();

    resetVerify();
  }, [
    clearOtaState,
    clearUploadStream,
    resetIotSketchVerify,
    resetIotUpload,
    resetVerify,
    setIotUploadOutput,
  ]);

  const baseUploadCommand = useCallback(
    async (options?: BaseUploadCommandOptions) => {
      addGenericBypassAutoSelection();
      compileErrorsTimestamp.current = Date.now();

      uploadCommandCleanup();

      if (
        compileUsageExceeded ||
        typeof compileUsageExceeded === 'undefined' ||
        isVerifying ||
        isVerifyingForIotUpload ||
        isUploading.value ||
        !commandParams ||
        !selectedPort
      ) {
        const error_message = commandParams?.initialSketchData.fqbn
          ? commandParams?.initialSketchData.boardType
            ? null
            : `can't detect board type`
          : `no target selected`;
        const error_code = commandParams?.initialSketchData.fqbn
          ? commandParams?.initialSketchData.boardType
            ? null
            : `C1`
          : `C0`;

        sendAnalyticsEvent({
          data: {
            board: commandParams?.initialSketchData?.fqbn ?? null,
            board_type: commandParams?.initialSketchData?.boardType ?? null,
            sketch: commandParams?.initialSketchData?.id,
            hex_len: null,
            error_code,
            error_message,
          },
          subtype: 'upload',
        });
        return;
      }

      if (saveOnVerifyAndUpload) {
        saveAllFiles();
      }

      if (preVerify && !(await preVerify())) {
        sendNotification({
          message: formatMessage(messages.notificationPreVerifyInterrupt),
          mode: NotificationMode.Toast,
          type: NotificationType.Change,
          modeOptions: {
            toastType: ToastType.Passive,
            toastSize: ToastSize.Small,
          },
        });
        return;
      }

      if (selectedBoardIsIot) {
        startIotUpload();
        return;
      }

      const updatedCompilePayload = createUpdatedCompilePayload({
        fqbn: commandParams.selectedFqbn,
        sketchData: commandParams.initialSketchData,
        mainInoData: commandParams.initialInoData,
        isVerboseOutput: consoleOutput === ConsoleOutput.Verbose,
        filesData: commandParams.initialFilesData,
        isIot: selectedBoardIsIot,
      });

      updatedCompilePayload.commandType = 'upload';
      updatedCompilePayload.shouldCache =
        !!commandParams.initialSketchData.fqbn ||
        !!commandParams.initialSketchData.thingId;

      sendAnalyticsEvent({
        data: {
          category: 'upload',
          action: 'main-toolbar',
        },
      });

      upload(
        commandParams.selectedFqbn,
        commandParams.initialSketchData.id,
        commandParams.initialSketchData.boardType,
        selectedPort,
        commandParams.initialSketchData.name,
        updatedCompilePayload,
        options?.existingCompilation,
      );
    },
    [
      addGenericBypassAutoSelection,
      commandParams,
      compileUsageExceeded,
      consoleOutput,
      formatMessage,
      isUploading.value,
      isVerifying,
      isVerifyingForIotUpload,
      preVerify,
      saveAllFiles,
      saveOnVerifyAndUpload,
      selectedBoardIsIot,
      selectedPort,
      startIotUpload,
      upload,
      uploadCommandCleanup,
    ],
  );

  const thingId = isCreatedSketch(initialSketchData)
    ? initialSketchData.thingId
    : undefined;

  const thingPropertiesFile = commandParams?.initialFilesData?.find(
    (f) => f.fullName === 'thingProperties.h',
  );

  const {
    checkThingCert,
    isLoading: thingCertCheckIsLoading,
    isMigrating: iotCertIsMigrating,
    cancel: clearIotCertCheck,
  } = useIotCertificateCheck(
    baseUploadCommand,
    refreshThingDeviceDetails,
    thingId,
    thingPropertiesFile?.path,
    commandParams?.initialSketchData.modifiedAt,
    thingPropertiesFile?.modifiedAt,
    isUploading.value || isVerifyingForIotUpload || isVerifying,
  );

  // This effect sets the flag to false when a verify process
  // is in progress. At this point, other flags exposed directly
  // by verify related hooks can be used to determine UI status
  useEffect(() => {
    if (uploadIsCompiling || isVerifyingForIotUpload) {
      setWaitingForCompilePostCertCheck(false);
    }
  }, [isVerifyingForIotUpload, uploadIsCompiling]);

  const uploadCommand = useCallback(
    async (baseUploadCommandOptions?: BaseUploadCommandOptions) => {
      if (isIotSketch && MIGRATE_IOT_CERT) {
        uploadCommandCleanup();

        setWaitingForCompilePostCertCheck(true);
        clearIotCertCheck();
        checkThingCert();
        return;
      }

      baseUploadCommand(baseUploadCommandOptions);
    },
    [
      baseUploadCommand,
      checkThingCert,
      clearIotCertCheck,
      isIotSketch,
      uploadCommandCleanup,
    ],
  );

  const verifyCommand = useCallback(
    async (
      existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
    ) => {
      setWaitingForCompilePostCertCheck(false);

      clearIotCertCheck();

      resetVerify();

      addGenericBypassAutoSelection();
      compileErrorsTimestamp.current = Date.now();

      clearUploadStream();

      setIotUploadOutput(undefined);
      clearOtaState();

      // reset of iot upload related queries is not strictly necessary
      // but done to avoid persisting data unrelated to the latest compile/upload
      resetIotUpload();
      resetIotSketchVerify();

      if (
        compileUsageExceeded ||
        typeof compileUsageExceeded === 'undefined' ||
        (isUploading.value && isUploading.phase === 'verify')
      )
        return;

      if (isVerifying) {
        resetVerify(true, commandParams?.initialSketchData.id);
        return;
      }

      if (isVerifyingForIotUpload) {
        resetIotSketchVerify(true);
        return;
      }

      if (!commandParams) return;

      // TODO move this to avoid unnecessary computation
      // when `continuePreviousCompilationById` will be invoked
      const updatedCompilePayload = createUpdatedCompilePayload({
        fqbn: commandParams.selectedFqbn,
        sketchData: commandParams.initialSketchData,
        mainInoData: commandParams.initialInoData,
        isVerboseOutput: consoleOutput === ConsoleOutput.Verbose,
        filesData: commandParams.initialFilesData,
      });

      updatedCompilePayload.commandType = 'verify';
      updatedCompilePayload.shouldCache =
        !!commandParams.initialSketchData.fqbn ||
        !!commandParams.initialSketchData.thingId;

      if (saveOnVerifyAndUpload) {
        saveAllFiles();
      }

      if (existingCompilation && existingCompilation?.id) {
        continuePreviousCompilationById(existingCompilation);
      } else {
        createCompilation(updatedCompilePayload);
      }

      sendAnalyticsEvent({
        data: {
          category: 'verify',
          action: 'main-toolbar',
        },
      });

      ga4Emitter({
        type: 'COMPILE',
        payload: { sketch_id: commandParams.initialSketchData.id },
      });
    },
    [
      addGenericBypassAutoSelection,
      clearIotCertCheck,
      clearOtaState,
      clearUploadStream,
      commandParams,
      compileUsageExceeded,
      consoleOutput,
      continuePreviousCompilationById,
      createCompilation,
      isUploading,
      isVerifying,
      isVerifyingForIotUpload,
      resetIotSketchVerify,
      resetIotUpload,
      resetVerify,
      saveAllFiles,
      saveOnVerifyAndUpload,
      setIotUploadOutput,
    ],
  );

  const { cachedCompileIsLoading } = useCachedSketchCompilation(
    !isCreatedSketch(initialSketchData) ||
      (!initialSketchData.fqbn && !isIotSketch) ||
      isVerifying ||
      isVerifyingForIotUpload ||
      isUploading.value ||
      !commandParams,
    baseUploadCommand,
    verifyCommand,
    selectedFqbn,
    isCreatedSketch(initialSketchData) ? initialSketchData : undefined,
  );

  const pendingCommand = useCallback(async () => {
    if (isPendingIot && isIotUploading) iotAbortPending();
  }, [iotAbortPending, isIotUploading, isPendingIot]);

  useEffect(() => {
    const isUploading =
      uploadIsCompiling ||
      uploadIsComputing ||
      uploadIsUploading ||
      isIotUploading;
    setIsUploading(
      isUploading
        ? {
            value: true,
            phase: uploadIsCompiling ? 'verify' : 'upload',
          }
        : { value: false },
    );
  }, [isIotUploading, uploadIsCompiling, uploadIsComputing, uploadIsUploading]);
  const status = useMemo(() => {
    if (
      isVerifying ||
      isVerifyingForIotUpload ||
      (isUploading.value && isUploading.phase === 'verify') ||
      iotCertIsMigrating ||
      thingCertCheckIsLoading ||
      waitingForCompilePostCertCheck
    ) {
      return ConsolePanelStatus.VERIFYING;
    }

    //Pending
    if (iotUploadOutput?.otaStatus === 'pending') {
      return ConsolePanelStatus.PENDING_OTA;
    }

    //Processing
    if (iotUploadOutput?.otaStatus === 'in_progress') {
      switch (iotUploadOutput?.step) {
        case 'available':
          return ConsolePanelStatus.AVAILABLE;
        case 'start':
          return ConsolePanelStatus.START;
        case 'fetch':
          return ConsolePanelStatus.FETCH;
        case 'flash':
          return ConsolePanelStatus.FLASH;
        case 'reboot':
          return ConsolePanelStatus.REBOOT;
        case 'fail':
          return ConsolePanelStatus.FAIL;
      }
    }

    //Upload
    if (uploadIsComputing || isUploading.value) {
      return ConsolePanelStatus.UPLOADING;
    }

    //Error
    if (
      compileHasFailed ||
      uploadCompileHasFailed ||
      uploadHasError ||
      iotUploadOutput?.hasFailed ||
      iotUploadHasError ||
      iotUploadOutput?.otaStatus === 'failed'
    ) {
      return ConsolePanelStatus.ERROR;
    }

    //Success
    if (
      (typeof iotUploadOutput === 'undefined' &&
        compileSketchResponseData?.output) ||
      (iotUploadOutput?.stage === 'upload' &&
        iotUploadOutput.otaStatus === 'succeeded') ||
      getUploadString()
    ) {
      return ConsolePanelStatus.SUCCESS;
    }

    return ConsolePanelStatus.IDLE;
  }, [
    isVerifying,
    isVerifyingForIotUpload,
    isUploading,
    iotCertIsMigrating,
    thingCertCheckIsLoading,
    waitingForCompilePostCertCheck,
    iotUploadOutput,
    uploadIsComputing,
    compileHasFailed,
    uploadCompileHasFailed,
    uploadHasError,
    iotUploadHasError,
    compileSketchResponseData?.output,
    getUploadString,
  ]);

  useEffect(() => {
    if (
      isExampleSketchRoute ||
      isLibraryRoute ||
      !isCreatedSketch(initialSketchData) ||
      isIotSketch || // disable modifying device metadata for IoT sketches
      !selectedFqbn ||
      !selectedBoard ||
      mutateSketchWithDeviceIsLoading ||
      status !== ConsolePanelStatus.SUCCESS
    )
      return;

    const fqbnHasChanged = initialSketchData.fqbn !== selectedFqbn;
    const boardNameHasChanged = initialSketchData.boardName !== selectedBoard;

    const selectedBoardType = selectedBoardIsIot ? 'cloud' : 'serial';
    const boardTypeHasChanged =
      initialSketchData.boardType !== selectedBoardType;

    const metadataIsStale =
      fqbnHasChanged || boardNameHasChanged || boardTypeHasChanged;

    if (!metadataIsStale) return;

    modifySketchData({
      fqbn: selectedFqbn,
      boardName: selectedBoard,
      boardType: selectedBoardType,
    });
    mutateSketchWithDevice({
      id: initialSketchData.id,
      board_fqbn: selectedFqbn,
      board_name: selectedBoard,
      board_type: selectedBoardType,
    });
  }, [
    initialSketchData,
    modifySketchData,
    mutateSketchWithDevice,
    mutateSketchWithDeviceIsLoading,
    selectedBoard,
    selectedFqbn,
    status,
    selectedBoardIsIot,
    isIotSketch,
    isExampleSketchRoute,
    isLibraryRoute,
  ]);

  const { open: openSerialMonitor, active: serialMonitorActive } =
    useSerialMonitorWindow(selectedBoard, selectedPort, uploadIsUploading);

  const uploadOutputWarnLineStart = ((): number | undefined => {
    if (!iotUploadHasError && !iotUploadOutput?.hasFailed && !uploadHasError)
      return;

    return iotUploadHasError || iotUploadOutput?.hasFailed
      ? // if there was an error, but no compile output (e.g. iot ready check failed, or iot upload "in prog on startup" failed),
        // "warn" (highlight) text from the beginning
        iotUploadOutputPostCompileLineStart || 1
      : uploadOutputLineStart;
  })();

  return {
    uploadCommand,
    verifyCommand,
    pendingCommand,
    compileString: compileSketchResponseData?.output,
    compileErrors:
      iotCompileErrors ||
      compileSketchResponseData?.errors ||
      uploadCompileErrors,
    compileResultMessages:
      iotCompileResultMessages ||
      uploadCompileResultMessages ||
      compileResultMessages,
    errorFiles: iotErrorFiles || uploadErrorFiles || errorFiles,
    compileOutputWarnLineStart:
      iotUploadOutput?.warnLineStart ||
      compileSketchResponseData?.warnLineStart ||
      uploadCompileWarnLineStart,
    compileOutputWarnLineEnd:
      iotUploadOutput?.warnLineEnd ||
      compileSketchResponseData?.warnLineEnd ||
      uploadCompileWarnLineEnd,
    uploadOutputWarnLineStart,
    compileErrorsTimestamp,
    iotUploadString: iotUploadOutput?.output,
    isUploading,
    isVerifying:
      isVerifyingForIotUpload ||
      isVerifying ||
      iotCertIsMigrating ||
      thingCertCheckIsLoading ||
      waitingForCompilePostCertCheck,
    isPending: isPendingIot,
    isCreating: isCreatingIot,
    consolePanelStatus: status,
    consolePanelProgress:
      iotCompileProgress ||
      iotUploadOutput?.progression ||
      compileProgress ||
      uploadCompilingProgress,
    openSerialMonitor,
    consolePanelErrReason: iotUploadOutput?.errorReason,
    serialMonitorActive,
    sketchDataIncompleteForCommands:
      Boolean(!commandParams && selectedFqbn) || cachedCompileIsLoading,
    shouldCheckForOngoingOta,
    iotCertIsMigrating: iotCertIsMigrating || thingCertCheckIsLoading,
  };
};
