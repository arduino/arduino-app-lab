import { Config, parseArduinoFqbn } from '@cloud-editor-mono/common';
import {
  codeInjectionsSubjectNext,
  codeSubjectNext,
  dismissToastNotification,
  downloadSketch,
  EndpointStatus,
  ga4Emitter,
  getBrowser,
  getCodeInjectionsSubject,
  getCodeSubjectById,
  getNewWindow,
  GetSketchResult,
  getUnsavedFilesSubject,
  isChromeOs,
  isPlayStoreApp,
  isPrivateResourceRequestWithOrgIdError,
  NotificationMode,
  POPUP_WINDOW_FEATURES,
  removeCodeSubjectBySketchPath,
  RetrieveFileContentsResult,
  retrieveSketches,
  send,
  sendNotification,
  SketchNameConflict,
  updateCodeSubjectHash,
} from '@cloud-editor-mono/domain';
import { replaceFileNameInvalidCharacters } from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  buildShareToClassroomURL,
  SketchData,
  SketchSecrets,
  USER_CLAIM_ID,
  USER_CLAIM_USERNAME,
} from '@cloud-editor-mono/infrastructure';
import {
  CodeEditorLogic,
  ConsolePanelLogic,
  DeleteFileDialogData,
  DeleteFileDialogLogic,
  DeleteSecretDialogData,
  DependentSidenavLogic,
  DetectedDevicesGroup,
  DeviceAssociationDialogLinks,
  DeviceAssociationDialogLogic,
  DeviceAssociationSteps,
  EditorControl,
  EditorControlsProps,
  EditorPanelLogic,
  FlavourConfigDialogLogic,
  GenAiBannerLogic,
  isPopulatedToolbarDevicesData,
  OnboardingLogic,
  OutputStringType,
  Preferences,
  ReadOnlyActionButtonsProps,
  ReadOnlyBarLogic,
  RenameDialogLogic,
  SecretsEditorLogic,
  ShareSketchDialogLogic,
  ShareToClassroomDialogLogic,
  TabsBarLogic,
  ToolbarItemIds,
  ToolbarLogic,
  useI18n,
} from '@cloud-editor-mono/ui-components';
import { redo, undo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { defaultStringifySearch, useSearch } from '@tanstack/react-location';
import { uniqueId } from 'lodash';
import _ from 'lodash';
import {
  Key,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation as reactUse_useLocation } from 'react-use';

import {
  getSelectedCodeObservableValue,
  useCodeChange,
  useCodeInjectionsObservable,
} from '../../../common/hooks/code';
import {
  codeEditorViewInstance,
  useCodeEditorViewInstance,
} from '../../../common/hooks/editor';
import { SKETCH_SECRETS_FILE_ID, useFiles } from '../../../common/hooks/files';
import { usePreferenceObservable } from '../../../common/hooks/preferences';
import { useActionFailuresHandler } from '../../../common/hooks/queries/actions';
import {
  refreshSketch,
  useAssociateSketchToLibraries,
  useCreateSketch,
  useCreateSketchFromExisting,
  useGetFileHash,
  useMarkSketchVisibility,
  useRenameSketch,
  useSaveSketchFile,
  useUpdateSketchSecrets,
} from '../../../common/hooks/queries/create';
import { useGenAIChat } from '../../../common/hooks/queries/genAi';
import { useIotSketch } from '../../../common/hooks/queries/iot';
import { useObservable } from '../../../common/hooks/useObservable';
import { AuthContext } from '../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../common/providers/component/componentContext';
import { useDialog } from '../../../common/providers/dialog/dialogProvider.logic';
import { SerialCommunicationContext } from '../../../common/providers/serial-communication/serialCommunicationContext';
import { getFileIcon } from '../../../common/utils';
import {
  EXAMPLES_MATCH_PATH,
  LIBRARIES_MATCH_PATH,
} from '../../../routing/Router';
import {
  CREATE_EXAMPLE_PARAM,
  CREATE_SKETCH_PARAM,
  HIDE_NUMBERS_PARAM,
  HIGHLIGHT_PARAM,
  SCOPE_PARAM,
  SearchGenerics,
  VIEW_MODE_PARAM,
} from '../../../routing/routing.type';
import {
  DeviceAssociationPrompts,
  DialogDataDictionary,
  DialogId,
  DialogInfo,
} from '../dialog-switch';
import { HeaderItemId, HeaderLogic } from '../header';
import {
  getCanUploadObj,
  useToolbarDevicesData,
} from '../toolbar/toolbar.logic';
import { useBoardsConfig, useDeviceMetadata } from './hooks/boards';
import { useComponentUpdate } from './hooks/componentUpdate';
import { useCoreCommands } from './hooks/coreCommands';
import {
  assertDialogType,
  useDeleteLibraryDialogLogic,
  useDeleteSecretDialogLogic,
  useDeleteSketchDialogLogic,
  useGenAIPolicyTermsDialogLogic,
  useGenericFlavourConfigDialogLogic,
  useGenericShareSketchDialogLogic,
} from './hooks/dialogs';
import { useGetExamplesQueries } from './hooks/examples';
import { useFullscreenState } from './hooks/fullscreen';
import { useGenAiBanner } from './hooks/genAiBanner';
import { useHeaderActions } from './hooks/header';
import { useSaveFileShortcut } from './hooks/keyboardShortcuts';
import { useGetLibrariesQueries } from './hooks/libraries';
import { useMobileWarning } from './hooks/mobile';
import { useOnboardingFlag } from './hooks/onboarding';
import {
  useRedirectAfterLogin,
  useRedirectToIoT,
  useRedirectToSketchRouteWOUsername,
  useTranslateHashToHighlightParam,
} from './hooks/routing';
import {
  SketchBroadcastEvent,
  useFileHandlers,
  useIsExampleRoute,
  useIsLibraryRoute,
  useIsSketchRouteWithUsername,
  useOpenSketchInNewWindow,
  useSketchParams,
} from './hooks/sketch';
import { useGetSketchStartUpQueries } from './hooks/startup';
import { useStatus } from './hooks/status';
import { useUIVisibilityFromUrl } from './hooks/visibility';
import { UseMainLogic } from './main.type';
import { messages } from './messages';
import {
  getDeviceSetupLink,
  isCustomLibAccessedFromSharedSpaceError,
  sketchNameValidation,
} from './utils';

export const useMainLogic: UseMainLogic =
  function (): ReturnType<UseMainLogic> {
    const { user, canUseGenAi } = useContext(AuthContext);
    const {
      isSketchQueried,
      sketchID,
      bypassIotRedirect,
      viewMode,
      scope,
      highlight,
      hideNumbers,
      createExampleParam,
    } = useSketchParams();

    const { headerless, isIotComponent } = useContext(ComponentContext);

    useRedirectAfterLogin();

    const {
      value: isSketchRouteWithUsername,
      username,
      sketchId: extractedSketchId,
    } = useIsSketchRouteWithUsername();

    const isLibraryRoute = useIsLibraryRoute();
    const isExampleSketchRoute = useIsExampleRoute();

    useRedirectToSketchRouteWOUsername(
      isSketchRouteWithUsername && !isLibraryRoute && !isExampleSketchRoute,
      extractedSketchId,
      username,
    );

    useTranslateHashToHighlightParam(!!viewMode);

    useMobileWarning(!viewMode);

    const {
      sketchData: _sketchData,
      sketchBoardData,
      modifySketchData,
      mainInoData: _mainInoData,
      files: _files,
      sketchDataIsNotLoaded,
      userWasAuthenticated,
      fileIsDeleting,
      deleteSketchFile,
      renameSketchFile,
      addSketchFile,
      isPrivateSketchViewedFromOrg,
      invalidateFilesList,
      refreshFileList,
      allContentsRetrieved: allSketchContentsRetrieved,
    } = useGetSketchStartUpQueries(isLibraryRoute, isExampleSketchRoute);

    const {
      iotDevicesGroups,
      isIotSketch,
      thingDeviceDetails,
      thingDeviceDetailsIsLoading,
      thingDeviceNotFound,
      refreshThingDeviceDetails,
    } = useIotSketch(!!viewMode, _sketchData);

    const {
      example,
      exampleData,
      exampleFiles,
      exampleIsFromLibrary,
      exampleIsFromCustomLibrary,
      exampleIsLoading,
      examplesMenuHandlers,
      allContentsRetrieved: allExampleContentsRetrieved,
      hydrateByPaths,
    } = useGetExamplesQueries(userWasAuthenticated, isExampleSketchRoute);

    const {
      customLibraryFiles,
      customLibrary,
      customLibraryIsLoading,
      customLibraryFilesAreLoading,
      libraryMenuHandlers,
      onLibraryUpload,
      isUploadingLibrary,
      allContentsRetrieved: allCustomLibraryContentsRetrieved,
    } = useGetLibrariesQueries(userWasAuthenticated, isLibraryRoute);

    const sketchData = example ?? _sketchData;
    const mainInoData = exampleData ?? _mainInoData;
    let files: RetrieveFileContentsResult[] | undefined;
    let allContentsRetrieved = false;
    switch (true) {
      case isExampleSketchRoute:
        files = exampleFiles;
        allContentsRetrieved = !!mainInoData && allExampleContentsRetrieved;
        break;
      case isLibraryRoute:
        files = customLibraryFiles;
        allContentsRetrieved = allCustomLibraryContentsRetrieved;
        break;
      default:
        files = _files;
        allContentsRetrieved = !!mainInoData && allSketchContentsRetrieved;
    }

    const allFiles = useMemo(
      () =>
        [mainInoData, ...(files ?? [])].filter<RetrieveFileContentsResult>(
          (f): f is RetrieveFileContentsResult => Boolean(f),
        ),
      [files, mainInoData],
    );

    const isCreatedSketch = ((data): data is GetSketchResult =>
      !example && !!data)(sketchData);

    useRedirectToIoT(
      !viewMode &&
        !Config.BYPASS_IOT_REDIRECT &&
        !bypassIotRedirect &&
        !isIotComponent &&
        isIotSketch,
      isCreatedSketch ? sketchData.thingId : undefined,
    );

    const deviceMetadata = useDeviceMetadata(
      isCreatedSketch ? sketchData : undefined,
      sketchBoardData,
      thingDeviceDetails,
      thingDeviceDetailsIsLoading,
    );

    const status = useStatus(userWasAuthenticated && !viewMode);

    const {
      coreEndpoints: {
        builder: builderStatus,
        create: createStatus, // eslint-disable-line @typescript-eslint/no-unused-vars
        agent: agentStatus,
      },
      network,
    } = status;

    const {
      mainFile: mainInoFile,
      editorFiles,
      openFiles,
      unsavedFileIds,
      selectedFile,
      selectFile,
      closeFile,
      updateOpenFile,
      updateOpenFilesOrder,
      onSketchRename,
    } = useFiles({
      mainFile: mainInoData,
      files,
      filesAreLoading:
        sketchDataIsNotLoaded &&
        exampleIsLoading &&
        customLibraryFilesAreLoading,
      filesContentLoaded: allContentsRetrieved,
      isLibraryRoute,
      showSketchSecretsFile: isCreatedSketch && !!sketchData.secrets,
      storeEntityId: isCreatedSketch ? sketchData.id : customLibrary?.id,
      getUnsavedFilesSubject,
    });

    const {
      setIsOpen: setIsDialogOpen,
      reactModalProps,
      dialogInfo,
      setDialogInfo,
    } = useDialog<DialogInfo>();

    const useRenameSketchDialogLogic = (): ReturnType<RenameDialogLogic> => {
      assertDialogType(DialogId.RenameSketch, dialogInfo);

      const { sketchName, sketchPath, sketchId } = dialogInfo.data;

      const { renameSketchMutate, isLoading } = useRenameSketch();

      const renameHandler = async (newName: string): Promise<void> => {
        await renameSketchMutate({
          from: sketchPath,
          to: sketchPath.replace(/\/[^/]+$/, `/${newName}`),
        });
        setIsDialogOpen(false);
        ga4Emitter({
          type: 'SKETCH_MOD',
          payload: { action: 'sketch_rename', sketch_id: sketchId },
        });

        send(SketchBroadcastEvent.SKETCH_UPDATE);
        //Cleans the old code subject
        removeCodeSubjectBySketchPath(sketchPath);
        onSketchRename(newName);
        refreshSketch();
      };

      const { wrappedAction: renameSketchHandler } = useActionFailuresHandler<
        void,
        [string]
      >({
        action: renameHandler,
        getKeyFromAction: () => `rename-sketch-${sketchPath}`,
        successMessage: messages.successfulSketchRename,
        customErrors: new Map([
          [
            SketchNameConflict as ErrorConstructor,
            messages.sketchNameAlreadyExists,
          ],
        ]),
      });

      return {
        reactModalProps,
        setIsOpen: setIsDialogOpen,
        renameAction: renameSketchHandler,
        renameActionLoading: isLoading,
        initialValue: sketchName,
        sketchNameValidation: sketchNameValidation,
        replaceSketchNameInvalidCharacters: replaceFileNameInvalidCharacters,
      };
    };

    const renameSketchDialogLogic = useCallback(useRenameSketchDialogLogic, [
      dialogInfo,
      onSketchRename,
      reactModalProps,
      setIsDialogOpen,
    ]);

    const { updateLogic: componentUpdateLogic } = useContext(ComponentContext);

    const promptBoardConfigSelection = useCallback(
      (data?: DialogDataDictionary[DialogId.DeviceAssociation]) => {
        setIsDialogOpen((isDialogOpen) => {
          if (isDialogOpen) {
            // dialog already open do nothing
            return isDialogOpen;
          }

          setDialogInfo({
            id: DialogId.DeviceAssociation,
            data,
          });

          return !isDialogOpen;
        });
      },
      [setDialogInfo, setIsDialogOpen],
    );

    const {
      setDetectedBoardAndPort,
      setDetectedUnknownBoard,
      setUndetectedBoard,
      selectedBoard,
      selectedFqbn,
      selectedArchitecture,
      selectedPort,
      selectedIotDeviceId,
      selectedBoardIsIot,
      detectedDevices,
      iotDevicesWithAssociationProp,
      includesUnknownBoard,
      manyBoardsMatchMetadata,
      currentDeviceIsBusy,
      selectedPortBoardId,
      selectedDeviceAltPortBoardId,
      switchToAltPort,
      selectedBoardFlavourOptions,
      selectFlavourOptionById,
      requestWebSerialBoardDetection,
      addGenericBypassAutoSelection,
      getDevicesListLogic,
      changeAssociatedBoard,
      selectedBoardData,
    } = useBoardsConfig(
      isExampleSketchRoute,
      !!createExampleParam,
      modifySketchData,
      promptBoardConfigSelection,
      isCreatedSketch ? sketchData.id : null,
      deviceMetadata.fqbn,
      deviceMetadata.boardName,
      deviceMetadata.architecture,
      deviceMetadata.boardType,
      Boolean(isIotSketch || isIotComponent),
      deviceMetadata.iotDeviceId,
      iotDevicesGroups,
    );

    useComponentUpdate(
      componentUpdateLogic,
      thingDeviceDetails,
      iotDevicesGroups,
      refreshFileList,
      refreshThingDeviceDetails,
      changeAssociatedBoard,
    );

    const { saveSketchFileQuery } = useSaveSketchFile(
      userWasAuthenticated && !viewMode,
    );

    const {
      uploadCommand,
      isUploading,
      verifyCommand,
      isVerifying,
      pendingCommand,
      isPending,
      isCreating,
      compileString,
      compileErrors,
      compileOutputWarnLineStart,
      compileOutputWarnLineEnd,
      uploadOutputWarnLineStart,
      compileErrorsTimestamp,
      iotUploadString,
      consolePanelStatus,
      consolePanelErrReason,
      consolePanelProgress,
      openSerialMonitor,
      serialMonitorActive,
      sketchDataIncompleteForCommands,
      shouldCheckForOngoingOta,
      compileResultMessages,
      errorFiles,
      iotCertIsMigrating,
    } = useCoreCommands(
      !!viewMode,
      isExampleSketchRoute,
      isLibraryRoute,
      modifySketchData,
      isIotSketch,
      selectedBoardIsIot,
      saveSketchFileQuery,
      addGenericBypassAutoSelection,
      thingDeviceDetailsIsLoading,
      isCreatedSketch ? allContentsRetrieved : allExampleContentsRetrieved,
      refreshThingDeviceDetails,
      mainInoData,
      sketchData,
      files,
      selectedFqbn,
      selectedBoard,
      selectedPort,
      selectedIotDeviceId,
    );

    const useFlavourConfigDialogLogic =
      (): ReturnType<FlavourConfigDialogLogic> => {
        const genericProps = useGenericFlavourConfigDialogLogic();

        return {
          ...genericProps,
          flavourOptions: selectedBoardFlavourOptions || undefined,
          setFlavourOptions: selectFlavourOptionById,
        };
      };

    const flavourConfigDialogLogic = useCallback(useFlavourConfigDialogLogic, [
      selectFlavourOptionById,
      selectedBoardFlavourOptions,
    ]);

    const openFlavourConfigDialog = useCallback(() => {
      setIsDialogOpen(true);
      setDialogInfo({
        id: DialogId.FlavourConfig,
        data: undefined,
      });
    }, [setIsDialogOpen, setDialogInfo]);

    const useShareSketchDialogLogic =
      (): ReturnType<ShareSketchDialogLogic> => {
        const { formatMessage } = useI18n();

        const genericProps = useGenericShareSketchDialogLogic();

        const { mutateSketchVisibility } = useMarkSketchVisibility();

        const loc = reactUse_useLocation();

        const embedSrc = loc.href && new URL(loc.href);
        if (embedSrc) embedSrc.searchParams.set('view-mode', 'embed');

        const targetUrl = loc.href && new URL(loc.href);
        if (targetUrl) targetUrl.searchParams.set('view-mode', 'preview');

        const lastToastId = useRef<string>();

        return {
          ...genericProps,
          onToggleVisibility: (isPublic: boolean): void => {
            if (isCreatedSketch) {
              modifySketchData({ isPublic });
              mutateSketchVisibility({
                id: sketchData.id,
                is_public: isPublic,
              });
              if (isPublic) {
                const toastId = uniqueId();
                sendNotification({
                  message: formatMessage(messages.shareSketchWarning),
                  mode: NotificationMode.Toast,
                  modeOptions: {
                    toastId,
                    toastOnClose: () => {
                      lastToastId.current = undefined;
                    },
                    toastActions: [
                      {
                        id: uniqueId(),
                        label: formatMessage(messages.shareSketchUndo),
                        handler: (): void => {
                          modifySketchData({ isPublic: false });
                          mutateSketchVisibility({
                            id: sketchData.id,
                            is_public: false,
                          });
                          dismissToastNotification(toastId);
                          lastToastId.current = undefined;
                        },
                      },
                    ],
                  },
                });
                lastToastId.current = toastId;
              } else {
                if (lastToastId.current) {
                  dismissToastNotification(lastToastId.current);
                  lastToastId.current = undefined;
                }
              }
            }
          },
          targetUrl: String(targetUrl),
          embedMarkup: `<iframe src="${embedSrc}" style="height:510px;width:100%;margin:10px 0" frameborder=0></iframe>`,
          ...(!isCreatedSketch
            ? { isOwned: false, isPublic: true }
            : { isOwned: true, isPublic: sketchData.isPublic }),
          organizationId: isCreatedSketch
            ? sketchData?.organizationId
            : undefined,
        };
      };

    const shareSketchLogic = useCallback(useShareSketchDialogLogic, [
      isCreatedSketch,
      modifySketchData,
      sketchData,
    ]);

    const useShareToClassroomDialogLogic =
      (): ReturnType<ShareToClassroomDialogLogic> => {
        const { canShareToClassroom } = useContext(AuthContext);

        const genericProps = useGenericShareSketchDialogLogic();

        const { formatMessage } = useI18n();

        const { mutateSketchVisibility } = useMarkSketchVisibility();

        const loc = reactUse_useLocation();

        const targetUrl = loc.href && new URL(loc.href);
        if (targetUrl) targetUrl.searchParams.set('view-mode', 'preview');

        const shareToClassroom = async (): Promise<void> => {
          if (isCreatedSketch) {
            await mutateSketchVisibility({
              id: sketchData.id,
              is_public: true,
            });

            if (targetUrl) {
              getNewWindow(
                buildShareToClassroomURL(
                  targetUrl,
                  formatMessage(messages.shareToClassroomTitle, {
                    title: sketchData.name,
                  }),
                  formatMessage(messages.shareToClassroomContent),
                ),
                undefined,
                'shareToClassroomDialog',
                POPUP_WINDOW_FEATURES,
              );
            } else {
              console.error('Failed to get current location');
            }
          }
        };

        return {
          ...genericProps,
          shareToClassroom,
          canShareToClassroom,
        };
      };

    const shareToClassroomLogic = useCallback(useShareToClassroomDialogLogic, [
      isCreatedSketch,
      sketchData,
    ]);

    const useToolbarLogic = (): ReturnType<ToolbarLogic> => {
      const { canUseOta } = useContext(AuthContext);
      const { uploadIsUploading } = useContext(SerialCommunicationContext);

      const [forceDisableUpload, setForceDisableUpload] = useState(false);

      useEffect(() => {
        if (uploadIsUploading) {
          setForceDisableUpload(true);

          return;
        }

        setTimeout(() => {
          setForceDisableUpload(false);
        }, 3000);
      }, [uploadIsUploading]);

      const { toolbarDevicesData, setSeenToolbarDevices } =
        useToolbarDevicesData(
          detectedDevices,
          iotDevicesWithAssociationProp &&
            iotDevicesWithAssociationProp[DetectedDevicesGroup.Online],
          reactModalProps.isOpen &&
            dialogInfo?.id === DialogId.DeviceAssociation,
        );

      const { compileUsageExceeded } = useContext(AuthContext);
      const { notificationElement } = useContext(ComponentContext);

      const currentIotDevice =
        iotDevicesWithAssociationProp &&
        [
          ...iotDevicesWithAssociationProp[DetectedDevicesGroup.Online],
          ...iotDevicesWithAssociationProp[DetectedDevicesGroup.Offline],
        ].find((d) => d.id === selectedIotDeviceId);

      return {
        selectedFqbn,
        selectedBoard,
        selectedPort,
        selectedBoardIsIot,
        isIotSketch,
        isIotComponent: Boolean(isIotComponent),
        canVerify: Boolean(
          !sketchDataIncompleteForCommands &&
            !shouldCheckForOngoingOta &&
            compileUsageExceeded === false &&
            network.online &&
            builderStatus !== EndpointStatus.Down &&
            selectedBoard,
        ),
        isUploading,
        isVerifying,
        isPending,
        isCreating,
        canUpload: manyBoardsMatchMetadata
          ? { value: true }
          : getCanUploadObj(
              sketchDataIncompleteForCommands,
              thingDeviceNotFound,
              shouldCheckForOngoingOta,
              network,
              builderStatus,
              agentStatus,
              selectedPort,
              compileUsageExceeded,
              selectedBoardIsIot && !canUseOta,
              selectedBoardIsIot && thingDeviceDetails?.otaCompatible === false,
              forceDisableUpload,
            ),
        boardsConfigIsUnknown: includesUnknownBoard,
        clickHandlers: {
          [ToolbarItemIds.VerifyButton]: verifyCommand,
          [ToolbarItemIds.UploadButton]:
            manyBoardsMatchMetadata && selectedFqbn
              ? (): void => {
                  setIsDialogOpen(true);
                  setDialogInfo({
                    id: DialogId.DeviceAssociation,
                    data: {
                      prompt: DeviceAssociationPrompts.Upload,
                      fqbn: parseArduinoFqbn(selectedFqbn).baseFqbn,
                    },
                  });
                }
              : uploadCommand,
          [ToolbarItemIds.PendingButton]: pendingCommand,
          [ToolbarItemIds.AssociationNode]: (
            ev: React.SyntheticEvent & {
              associationViaWebSerialDetection?: boolean;
            },
          ): void => {
            if (ev.associationViaWebSerialDetection) {
              requestWebSerialBoardDetection();
            } else {
              setIsDialogOpen(true);
              setDialogInfo({
                id: DialogId.DeviceAssociation,
              });
              isPopulatedToolbarDevicesData(toolbarDevicesData) &&
                setSeenToolbarDevices(toolbarDevicesData.ids);
            }
          },
          [ToolbarItemIds.OpenSerialMonitor]: openSerialMonitor,
          [ToolbarItemIds.OpenFlavourConfig]: openFlavourConfigDialog,
          [ToolbarItemIds.DownloadSketch]: () =>
            isCreatedSketch && mainInoData
              ? downloadSketch(
                  sketchData.name,
                  sketchData.path,
                  mainInoData,
                  files || [],
                )
              : null,
        },
        devices: toolbarDevicesData,
        markDevicesAsSeen: (): void => {
          isPopulatedToolbarDevicesData(toolbarDevicesData) &&
            setSeenToolbarDevices(toolbarDevicesData.ids);
        },
        manyPortsAvailable: manyBoardsMatchMetadata,
        disableBoardBubbleBadge:
          isIotSketch ||
          isIotComponent ||
          (reactModalProps.isOpen &&
            dialogInfo?.id === DialogId.DeviceAssociation),
        currentDeviceIsBusy: currentDeviceIsBusy && !serialMonitorActive,
        currentDeviceSupportsOta: !!currentIotDevice?.otaCompatible,
        selectedPortBoardId,
        selectedDeviceAltPortBoardId: selectedDeviceAltPortBoardId?.id,
        switchToAltPort,
        notificationElement,
        useChromeOsDeviceAssociation: isChromeOs,
        deviceSetupLink: isCreatedSketch
          ? getDeviceSetupLink(sketchData.thingId)
          : undefined,
        shareSketchLogic,
        shareToClassroomLogic,
      };
    };

    const toolbarLogic = useCallback(useToolbarLogic, [
      detectedDevices,
      iotDevicesWithAssociationProp,
      reactModalProps.isOpen,
      dialogInfo?.id,
      selectedFqbn,
      selectedBoard,
      selectedPort,
      selectedBoardIsIot,
      isIotSketch,
      isIotComponent,
      sketchDataIncompleteForCommands,
      network,
      builderStatus,
      isUploading,
      isVerifying,
      isPending,
      isCreating,
      manyBoardsMatchMetadata,
      thingDeviceNotFound,
      shouldCheckForOngoingOta,
      agentStatus,
      thingDeviceDetails?.otaCompatible,
      includesUnknownBoard,
      verifyCommand,
      uploadCommand,
      pendingCommand,
      openSerialMonitor,
      openFlavourConfigDialog,
      currentDeviceIsBusy,
      serialMonitorActive,
      selectedPortBoardId,
      selectedDeviceAltPortBoardId?.id,
      switchToAltPort,
      isCreatedSketch,
      sketchData,
      shareSketchLogic,
      shareToClassroomLogic,
      selectedIotDeviceId,
      setIsDialogOpen,
      setDialogInfo,
      requestWebSerialBoardDetection,
      mainInoData,
      files,
    ]);

    const deviceAssociationDialogLogic =
      (): ReturnType<DeviceAssociationDialogLogic> => {
        return {
          reactModalProps,
          setIsOpen: setIsDialogOpen,
          detectedDevices,
          iotDevicesGroups: iotDevicesWithAssociationProp,
          setDetectedBoardAndPort,
          setDetectedUnknownBoard,
          setUndetectedBoard,
          boardsConfigIsUnknown: includesUnknownBoard,
          portIsSelected: Boolean(selectedPort),
          agentIsNotDetected: agentStatus === EndpointStatus.Down,
          canDownloadAgent: !isPlayStoreApp(),
          onClickDownloadAgent: (): void => {
            if (isPlayStoreApp()) {
              return;
            }
            getNewWindow(Config.ARDUINO_CREATE_AGENT_GETTING_STARTED_URL);
          },
          links: {
            [DeviceAssociationDialogLinks.TroubleShootingDevices]:
              !isPlayStoreApp()
                ? Config.ARDUINO_SUPPORT_DEVICES_TROUBLESHOOTING_URL
                : '',
            [DeviceAssociationDialogLinks.TroubleshootingAgent]:
              !isPlayStoreApp() ? Config.ARDUINO_SUPPORT_AGENT_URL : '',
          },
          initialStep: isChromeOs
            ? DeviceAssociationSteps.ChromeOSManualSelection
            : undefined,
          getDevicesListLogic,
          usingWebSerial: isChromeOs,
        };
      };

    const deviceAssociationDialogKey = JSON.stringify(
      iotDevicesWithAssociationProp
        ? [
            iotDevicesWithAssociationProp[DetectedDevicesGroup.Online]
              .length === 0,
            iotDevicesWithAssociationProp[DetectedDevicesGroup.Offline]
              .length === 0,
          ]
        : [false, false],
    );

    const visibilityFromUrl = useUIVisibilityFromUrl();

    const {
      addFileHandler,
      renameFileHandler,
      deleteFileHandler,
      onBeforeFileAction,
      validateFileName,
      makeUniqueFileName,
    } = useFileHandlers(
      mainInoFile,
      editorFiles,
      openFiles,
      selectedFile,
      selectFile,
      closeFile,
      updateOpenFile,
      addSketchFile,
      renameSketchFile,
      deleteSketchFile,
      exampleData,
      exampleFiles,
    );

    const useDeleteFileDialogLogic = (): ReturnType<DeleteFileDialogLogic> => {
      const { fileId, fileFullName } = dialogInfo?.data as DeleteFileDialogData;

      const confirmAction = (): void => {
        setIsDialogOpen(false);
        deleteFileHandler(fileId);
      };

      return {
        reactModalProps,
        setIsOpen: setIsDialogOpen,
        confirmAction,
        cancelAction: (): void => setIsDialogOpen(false),
        fileId,
        fileFullName,
      };
    };
    const deleteFileDialogLogic = useCallback(useDeleteFileDialogLogic, [
      deleteFileHandler,
      dialogInfo,
      reactModalProps,
      setIsDialogOpen,
    ]);

    const openDeleteFileDialog = useCallback(
      async (fileId: string): Promise<void> => {
        const file = editorFiles.find((f) => f.fileId === fileId);
        if (file) {
          setIsDialogOpen(true);
          setDialogInfo({
            id: DialogId.DeleteFile,
            data: {
              fileId,
              fileFullName: file.fileFullName,
            },
          });
        }
      },
      [editorFiles, setIsDialogOpen, setDialogInfo],
    );

    // Trigger the UX flow in EditorTabs from the sketch explorer
    const [dispatchNewFileAction, setDispatchNewFileAction] =
      useState<Key | null>(null);

    const useTabsBarLogic = (): ReturnType<TabsBarLogic> => {
      const browser = getBrowser();
      const hasSetHeightOnHover = Boolean(
        browser?.includes('Safari') ||
          browser?.includes('Opera') ||
          browser?.includes('Chrome'),
      );

      return {
        tabs: openFiles,
        selectableMainFile: mainInoFile,
        selectedTab: selectedFile,
        selectTab: selectFile,
        selectSecretsTab: () => selectFile(SKETCH_SECRETS_FILE_ID),
        closeTab: closeFile,
        updateTabOrder: updateOpenFilesOrder,
        sketchDataIsLoading:
          sketchDataIsNotLoaded &&
          exampleIsLoading &&
          customLibraryFilesAreLoading,
        unsavedFileIds,
        onBeforeFileAction,
        addFile: addFileHandler,
        renameFile: renameFileHandler,
        deleteFile: openDeleteFileDialog,
        validateFileName,
        replaceFileNameInvalidCharacters,
        makeUniqueFileName,
        getFileIcon,
        isReadOnly: isLibraryRoute || !!viewMode,
        isExampleSketchRoute,
        hasSetHeightOnHover,
        dispatchNewFileAction,
        setDispatchNewFileAction,
      };
    };

    const tabsBarLogic = useCallback(useTabsBarLogic, [
      addFileHandler,
      closeFile,
      customLibraryFilesAreLoading,
      dispatchNewFileAction,
      exampleIsLoading,
      isExampleSketchRoute,
      isLibraryRoute,
      mainInoFile,
      makeUniqueFileName,
      onBeforeFileAction,
      openDeleteFileDialog,
      openFiles,
      renameFileHandler,
      selectFile,
      selectedFile,
      sketchDataIsNotLoaded,
      unsavedFileIds,
      updateOpenFilesOrder,
      validateFileName,
      viewMode,
    ]);

    const onReceiveViewInstance = useCallback(
      (viewInstance: EditorView | null): void => {
        codeEditorViewInstance.instance = viewInstance;
      },
      [],
    );

    const { scrollToTop, scrollToLine } = useCodeEditorViewInstance(
      selectFile,
      openFiles,
    );

    const {
      setCode,
      formatCode,
      codeIsFormatting,
      handleLibraryIncludeCode,
      handleGenAiApplyCode,
      handleGenAiApplyFixToCode,
      handleApplyPatchAvailability,
      errorLineData,
      saveAllFiles,
      saveFile,
      saveCode,
    } = useCodeChange(
      saveSketchFileQuery,
      selectFile,
      codeInjectionsSubjectNext,
      getCodeSubjectById,
      codeSubjectNext,
      getUnsavedFilesSubject,
      updateCodeSubjectHash,
      useCreateSketchFromExisting,
      retrieveSketches,
      isLibraryRoute,
      isExampleSketchRoute,
      !!viewMode,
      selectedFile,
      mainInoFile,
      compileErrors,
      compileErrorsTimestamp,
      openFiles,
      exampleData,
      exampleFiles,
      customLibraryFiles,
    );

    useSaveFileShortcut(saveFile, selectedFile?.fileId);

    const errorLines = useMemo(() => {
      return errorLineData &&
        errorLineData.filefullname === selectedFile?.fileFullName
        ? [Number(errorLineData.row)]
        : undefined;
    }, [errorLineData, selectedFile?.fileFullName]);

    const highlightLines = useMemo(() => {
      return openFiles[0] && openFiles[0].fileId === selectedFile?.fileId
        ? highlight?.map((l) => (!scope ? l : l - (scope.start - 1)))
        : undefined;
    }, [highlight, openFiles, scope, selectedFile?.fileId]);

    const gutter = useMemo(() => {
      return hideNumbers
        ? undefined
        : { lineNumberStartOffset: scope ? scope.start - 1 : 0 };
    }, [hideNumbers, scope]);

    const { isFullscreen, onOpenFullscreen, onCloseFullscreen } =
      useFullscreenState();

    const showHeader = !isFullscreen && visibilityFromUrl.header;
    const useCodeEditorLogic = (): ReturnType<CodeEditorLogic> => {
      useCodeInjectionsObservable(getCodeInjectionsSubject);

      return {
        setCode,
        sketchDataIsLoading:
          sketchDataIsNotLoaded &&
          exampleIsLoading &&
          customLibraryFilesAreLoading,
        getCode: () =>
          getSelectedCodeObservableValue(
            getCodeSubjectById,
            selectedFile?.fileId,
          )?.value,
        getCodeExt: () =>
          getSelectedCodeObservableValue(
            getCodeSubjectById,
            selectedFile?.fileId,
          )?.meta.ext,
        getCodeInstanceId: () =>
          getSelectedCodeObservableValue(
            getCodeSubjectById,
            selectedFile?.fileId,
          )?.meta.instanceId,
        getCodeLastInjectionLine: (): number | undefined => {
          const value = getSelectedCodeObservableValue(
            getCodeSubjectById,
            selectedFile?.fileId,
          );
          const lineToScroll = value?.meta.lineToScroll;
          if (value) {
            codeInjectionsSubjectNext(
              value.fileId,
              value.value,
              { saveCode },
              false,
              undefined,
            );
          }
          return lineToScroll;
        },
        getFileId: () => selectedFile?.fileId,
        codeInstanceIds: openFiles
          .map(
            (t) =>
              getSelectedCodeObservableValue(getCodeSubjectById, t.fileId)?.meta
                .instanceId,
          )
          .filter((id): id is string => Boolean(id)),
        errorLines,
        highlightLines,
        onReceiveViewInstance,
        fontSize: Number(usePreferenceObservable(Preferences.FontSize)),
        gutter,
        readOnly: !!viewMode,
        hasHeader: showHeader,
        hasTabs: viewMode !== 'snippet',
      };
    };

    const codeEditorLogic = useCallback(useCodeEditorLogic, [
      setCode,
      sketchDataIsNotLoaded,
      exampleIsLoading,
      customLibraryFilesAreLoading,
      openFiles,
      errorLines,
      highlightLines,
      onReceiveViewInstance,
      gutter,
      viewMode,
      showHeader,
      selectedFile?.fileId,
      saveCode,
    ]);

    const useSecretsEditorLogic = (): ReturnType<SecretsEditorLogic> => {
      const { mutateSketchWithSecrets } = useUpdateSketchSecrets();

      const updateSecrets = useCallback(
        async (secrets?: SketchSecrets): Promise<void> => {
          if (!isCreatedSketch) {
            throw Error("Can't update sketch secrets without sketch data");
          }
          modifySketchData({ secrets });
          mutateSketchWithSecrets({ id: sketchData.id, secrets });
        },
        [mutateSketchWithSecrets],
      );

      const openDeleteSecretDialog = (data: DeleteSecretDialogData): void => {
        setDialogInfo({ id: DialogId.DeleteSecret, data });
        setIsDialogOpen(true);
      };

      return {
        secrets: isCreatedSketch ? sketchData.secrets : undefined,
        updateSecrets,
        openDeleteSecretDialog,
      };
    };

    const secretsEditorLogic = useCallback(useSecretsEditorLogic, [
      sketchData,
      isCreatedSketch,
      modifySketchData,
      setDialogInfo,
      setIsDialogOpen,
    ]);

    const cancelPendingFileActions = useCallback(() => {
      if (dialogInfo?.id === DialogId.DeleteFile) {
        setIsDialogOpen(false);
        setDialogInfo(undefined);
      }
    }, [dialogInfo?.id, setIsDialogOpen, setDialogInfo]);

    const useEditorPanelLogic = (): ReturnType<EditorPanelLogic> => {
      const isOrganizationSketch =
        isCreatedSketch && !!sketchData?.organizationId;

      const { isConcurrent } = useGetFileHash(
        isCreatedSketch &&
          !sketchDataIsNotLoaded &&
          allSketchContentsRetrieved &&
          !isLibraryRoute &&
          !isExampleSketchRoute &&
          isOrganizationSketch &&
          !!selectedFile &&
          !fileIsDeleting &&
          !!user?.[USER_CLAIM_USERNAME] &&
          !iotCertIsMigrating,
        invalidateFilesList,
        cancelPendingFileActions,
        isCreatedSketch ? sketchData.path : undefined,
        selectedFile?.fileId,
        user?.[USER_CLAIM_USERNAME],
      );

      const controlsProps = {} as EditorControlsProps;

      if (viewMode) {
        controlsProps.hideControls = true;
        controlsProps.editorControlsHandlers = undefined;
      } else {
        controlsProps.hideControls = false;
        controlsProps.editorControlsHandlers = {
          [EditorControl.Fullscreen]: !headerless
            ? (): void => {
                if (!isFullscreen) {
                  onOpenFullscreen();
                  return;
                }

                onCloseFullscreen();
              }
            : undefined,
          [EditorControl.Indent]: (): void => {
            const code = getSelectedCodeObservableValue(
              getCodeSubjectById,
              selectedFile?.fileId,
            )?.value;

            if (code) {
              formatCode({ code, fileId: selectedFile?.fileId });
            }
          },
          [EditorControl.Undo]: (): void => {
            if (codeEditorViewInstance.instance) {
              undo({
                state: codeEditorViewInstance.instance.state,
                dispatch: codeEditorViewInstance.instance.dispatch,
              });
            }
          },
          [EditorControl.Redo]: (): void => {
            if (codeEditorViewInstance.instance) {
              redo({
                state: codeEditorViewInstance.instance.state,
                dispatch: codeEditorViewInstance.instance.dispatch,
              });
            }
          },
        };
      }

      return {
        tabsBarLogic,
        codeEditorLogic,
        secretsEditorLogic,
        selectedFile: selectedFile
          ? {
              id: selectedFile.fileId,
              ext: selectedFile.fileExtension,
              getData: () =>
                getSelectedCodeObservableValue(
                  getCodeSubjectById,
                  selectedFile.fileId,
                )?.value,
            }
          : undefined,
        ...controlsProps,
        isFullscreen,
        codeIsFormatting,
        isConcurrent: isConcurrent,
        hideTabs: viewMode === 'snippet',
      };
    };

    const editorPanelLogic = useCallback(useEditorPanelLogic, [
      isCreatedSketch,
      sketchData,
      sketchDataIsNotLoaded,
      allSketchContentsRetrieved,
      isLibraryRoute,
      isExampleSketchRoute,
      selectedFile,
      fileIsDeleting,
      user,
      iotCertIsMigrating,
      invalidateFilesList,
      cancelPendingFileActions,
      viewMode,
      tabsBarLogic,
      codeEditorLogic,
      secretsEditorLogic,
      isFullscreen,
      codeIsFormatting,
      headerless,
      onCloseFullscreen,
      onOpenFullscreen,
      formatCode,
    ]);

    const {
      sendTextMessage,
      promptResponseIsLoading: isErrorExplanationSending,
      isStreamSending: isErrorExplanationStreamSending,
      stopGeneration: stopErrorExplanationGeneration,
    } = useGenAIChat(
      !!canUseGenAi,
      selectedBoard,
      selectedBoardData?.name,
      errorFiles,
    );

    const useConsolePanelLogic = (): ReturnType<ConsolePanelLogic> => {
      const { uploadStream } = useContext(SerialCommunicationContext);
      const { aiUserPlan, genAiInteractions } = useContext(AuthContext);

      const uploadString = useObservable(uploadStream);

      const id = uniqueId();
      const compileOutputWarnRange =
        typeof compileOutputWarnLineStart !== 'undefined' &&
        typeof compileOutputWarnLineEnd !== 'undefined'
          ? _.range(compileOutputWarnLineStart, compileOutputWarnLineEnd + 1, 1)
          : undefined;

      const newLineRegEx = /\r\n|\r|\n/;
      const uploadOutputWarnRange =
        typeof uploadOutputWarnLineStart !== 'undefined' &&
        (iotUploadString || uploadString)
          ? _.range(
              uploadOutputWarnLineStart,
              ((iotUploadString || uploadString) as string)?.split(newLineRegEx)
                .length + 1,
              1,
            )
          : undefined;
      return {
        getOutputStringInstanceId: (): string => {
          // Whenever there is an output string, we want to refresh the console instance.
          if (compileString || iotUploadString || uploadString) {
            return id;
          }

          // Whenever there is no output string, we want to keep the instance id.
          return OutputStringType.None;
        },
        getOutputString: () => compileString || iotUploadString || uploadString,
        errorLines:
          uploadOutputWarnRange && compileOutputWarnRange
            ? [
                ...new Set([
                  ...compileOutputWarnRange,
                  ...uploadOutputWarnRange,
                ]),
              ]
            : compileOutputWarnRange || uploadOutputWarnRange,
        status: consolePanelStatus,
        errReason: consolePanelErrReason,
        progression: consolePanelProgress,
        sketchName: sketchData?.name || 'sketch',
        sendTextMessage,
        compileResultMessages,
        canUseGenAi: !!canUseGenAi,
        aiUserPlan,
        genAiMessageUsageExceeded:
          Config.MODE !== 'production' &&
          genAiInteractions &&
          genAiInteractions?.usage >= genAiInteractions?.limit,
        upgradePlanLinkEnabled: !isPlayStoreApp(),
      };
    };

    const consolePanelLogic = useCallback(useConsolePanelLogic, [
      compileOutputWarnLineStart,
      compileOutputWarnLineEnd,
      uploadOutputWarnLineStart,
      iotUploadString,
      consolePanelStatus,
      consolePanelErrReason,
      consolePanelProgress,
      sketchData?.name,
      sendTextMessage,
      compileResultMessages,
      canUseGenAi,
      compileString,
    ]);

    const useGenAiBannerLogic = (): ReturnType<GenAiBannerLogic> => {
      const { dismissGenAiBanner, isGenAiBannerDismissed } = useGenAiBanner();
      const { aiUserPlan } = useContext(AuthContext);
      return {
        dismissGenAiBanner,
        isGenAiBannerDismissed,
        aiUserPlan,
      };
    };

    const genAiBannerLogic = useCallback(useGenAiBannerLogic, []);

    const useDependentSidenavLogic = (): ReturnType<DependentSidenavLogic> => {
      const { user: scopedUser } = useContext(AuthContext);
      const [bypassOrgHeader, setBypassOrgHeader] = useState(false);

      const onPrivateResourceRequestError = useCallback(
        (error: unknown): { errorIsManaged: boolean } => {
          if (!error) {
            return { errorIsManaged: false };
          }

          if (
            isPrivateResourceRequestWithOrgIdError(error, (errCause) => {
              return isCustomLibAccessedFromSharedSpaceError(
                errCause,
                scopedUser,
              );
            })
          ) {
            setBypassOrgHeader(true);
            return { errorIsManaged: true };
          }

          if (bypassOrgHeader) {
            setBypassOrgHeader(false);
            return { errorIsManaged: false };
          }

          return { errorIsManaged: false };
        },
        [bypassOrgHeader, scopedUser],
      );

      const openGenAIPolicyTermsDialog = useCallback(() => {
        setIsDialogOpen(true);
        setDialogInfo({
          id: DialogId.GenAIPolicyTerms,
          data: undefined,
        });
      }, []);

      const { mutateSketchWithLibraries } = useAssociateSketchToLibraries();

      return {
        handleLibraryInclude: (code, meta): void => {
          scrollToTop();

          handleLibraryIncludeCode(code);

          if (isCreatedSketch && meta) {
            const currentLibs = sketchData.libraries;
            const otherLibs = currentLibs.filter((l) => l.name !== meta.name);

            const modifySketchMetadata = (
              id: string,
              libraries: SketchData['libraries'],
            ): void => {
              modifySketchData({ libraries });
              mutateSketchWithLibraries({
                id,
                libraries,
              });
            };

            if (!meta.version) {
              modifySketchMetadata(sketchData.id, otherLibs);

              return;
            }

            modifySketchMetadata(sketchData.id, [
              ...otherLibs,
              { name: meta.name, version: meta.version },
            ]);
          }
        },
        handleGenAiApplyCode,
        handleGenAiApplyFixToCode,
        handleApplyPatchAvailability,
        pinnedLibraries: isCreatedSketch ? sketchData.libraries : undefined,
        isExampleSketchRoute,
        exampleIsFromLibrary,
        exampleIsFromCustomLibrary,
        canModifySketchMetadata: isCreatedSketch,
        examplesMenuHandlers,
        libraryMenuHandlers,
        selectedBoard,
        boardName: selectedBoardData?.name,
        selectedArchitecture,
        enableGetCustomLibraries: userWasAuthenticated,
        saveAllFiles,
        onLibraryUpload,
        isUploadingLibrary,
        bypassOrgHeader,
        onPrivateResourceRequestError,
        explorerFiles: editorFiles,
        isLoadingFiles: !allContentsRetrieved,
        unsavedFileIds,
        selectedFile,
        selectFile,
        renameFile: renameFileHandler,
        deleteFile: openDeleteFileDialog,
        newFileAction: setDispatchNewFileAction,
        validateFileName,
        replaceFileNameInvalidCharacters,
        isReadOnly: isLibraryRoute || !!viewMode || isExampleSketchRoute,
        genAiBannerLogic,
        scrollToLine,
        errorLines,
        isErrorExplanationSending,
        isErrorExplanationStreamSending,
        stopErrorExplanationGeneration,
        errorFiles,
        isAiRestrictionsEnabled: Config.MODE !== 'production',
        openGenAIPolicyTermsDialog,
        hydrateByPaths,
      };
    };

    const dependentSidenavLogic = useCallback(useDependentSidenavLogic, [
      handleGenAiApplyCode,
      handleGenAiApplyFixToCode,
      handleApplyPatchAvailability,
      isCreatedSketch,
      sketchData,
      isExampleSketchRoute,
      exampleIsFromLibrary,
      exampleIsFromCustomLibrary,
      examplesMenuHandlers,
      libraryMenuHandlers,
      selectedBoard,
      selectedBoardData?.name,
      selectedArchitecture,
      userWasAuthenticated,
      saveAllFiles,
      onLibraryUpload,
      isUploadingLibrary,
      editorFiles,
      allContentsRetrieved,
      unsavedFileIds,
      selectedFile,
      selectFile,
      renameFileHandler,
      openDeleteFileDialog,
      validateFileName,
      isLibraryRoute,
      viewMode,
      genAiBannerLogic,
      scrollToLine,
      errorLines,
      isErrorExplanationSending,
      isErrorExplanationStreamSending,
      stopErrorExplanationGeneration,
      errorFiles,
      setIsDialogOpen,
      setDialogInfo,
      scrollToTop,
      handleLibraryIncludeCode,
      modifySketchData,
      hydrateByPaths,
    ]);

    const { createdSketch: userCreatedSketch } = useCreateSketch();
    useOpenSketchInNewWindow(userCreatedSketch?.id);

    const itemName = isLibraryRoute ? customLibrary?.name : sketchData?.name;
    const useHeaderLogic = (): ReturnType<HeaderLogic> => {
      const { user, canShareToClassroom } = useContext(AuthContext);

      const headerItemId = isLibraryRoute
        ? HeaderItemId.CustomLibrary
        : isExampleSketchRoute
        ? HeaderItemId.Example
        : HeaderItemId.Sketch;

      const headerActions = useHeaderActions({
        sketchData: isCreatedSketch ? sketchData : undefined,
        customLibrary,
        example,
        inoFile: mainInoData,
        files: files,
      });

      return {
        user,
        isReadOnly: Boolean(viewMode),
        canShareToClassroom: isCreatedSketch && canShareToClassroom,
        readOnlyAvatarLink: !isPlayStoreApp() ? Config.ID_URL : '',
        headerItemId,
        itemName,
        itemDataIsLoading:
          sketchDataIsNotLoaded && exampleIsLoading && customLibraryIsLoading,
        headerActions: viewMode ? undefined : headerActions,
      };
    };

    const headerLogic = useCallback(useHeaderLogic, [
      isLibraryRoute,
      isExampleSketchRoute,
      isCreatedSketch,
      sketchData,
      customLibrary,
      example,
      mainInoData,
      files,
      viewMode,
      itemName,
      sketchDataIsNotLoaded,
      exampleIsLoading,
      customLibraryIsLoading,
    ]);

    const useOnboardingLogic: OnboardingLogic =
      (): ReturnType<OnboardingLogic> => {
        const { onboardingDone, setOnboardingDone } = useOnboardingFlag();

        return {
          onboardingDone: onboardingDone || !sketchData?.name,
          setOnboardingDone,
          sketchName: sketchData?.name,
        };
      };

    const onboardingLogic = useCallback(useOnboardingLogic, [sketchData?.name]);

    const dialogSwitchLogic = {
      deviceAssociationDialogKey,
      deviceAssociationDialogLogic,
      deleteFileDialogLogic,
      renameSketchDialogLogic,
      deleteSketchDialogLogic: useDeleteSketchDialogLogic,
      deleteLibraryDialogLogic: useDeleteLibraryDialogLogic,
      deleteSecretDialogLogic: useDeleteSecretDialogLogic,
      flavourConfigDialogLogic,
      shareSketchDialogLogic: shareSketchLogic,
      shareToClassroomDialogLogic: shareToClassroomLogic,
      genAIPolicyTermsDialogLogic: useGenAIPolicyTermsDialogLogic,
    };

    const sketchStats = useMemo(() => {
      if (!isCreatedSketch) return undefined;

      const { size, createdAt, modifiedAt } = sketchData;

      const created = new Date(createdAt).toLocaleString();
      const modified = new Date(modifiedAt).toLocaleString();

      return {
        size: size ? `${size / 1000} KB` : undefined,
        created,
        modified,
      };
    }, [isCreatedSketch, sketchData]);

    const useReadOnlyBarLogic: ReadOnlyBarLogic =
      (): ReturnType<ReadOnlyBarLogic> => {
        const headerActions = useHeaderActions({
          sketchData: isCreatedSketch ? sketchData : undefined,
          customLibrary,
          example,
          files: allFiles,
        });

        const search = useSearch<SearchGenerics>();

        const item = customLibrary
          ? customLibrary
          : isCreatedSketch
          ? sketchData
          : undefined;

        const isMine = item?.userId === user?.[USER_CLAIM_ID];
        const isMineAndInCurrentOrg = isMine && !isPrivateSketchViewedFromOrg;
        const actionButtons: ReadOnlyActionButtonsProps =
          itemName && typeof user !== 'undefined'
            ? {
                primary: {
                  onClick: (): void => {
                    const sketchUrl = `${
                      Config.ROUTING_BASE_URL
                        ? `/${Config.ROUTING_BASE_URL}`
                        : ''
                    }${
                      isSketchQueried
                        ? `/${sketchID}`
                        : isLibraryRoute
                        ? LIBRARIES_MATCH_PATH
                        : EXAMPLES_MATCH_PATH
                    }`;

                    const params: [string, string][] = Object.entries(search)
                      .filter(([param, _]) => {
                        return ![
                          VIEW_MODE_PARAM,
                          SCOPE_PARAM,
                          HIGHLIGHT_PARAM,
                          HIDE_NUMBERS_PARAM,
                        ].includes(param);
                      })
                      .map(([key, value]) => [key, value]);

                    if (isExampleSketchRoute) {
                      params.push([CREATE_EXAMPLE_PARAM, 'true']);
                    }

                    if (
                      !isMineAndInCurrentOrg &&
                      !isLibraryRoute &&
                      !isExampleSketchRoute
                    ) {
                      params.push([CREATE_SKETCH_PARAM, 'true']);
                    }

                    const result = getNewWindow(
                      `${Config.NEW_WINDOW_ORIGIN}${sketchUrl}`,
                      defaultStringifySearch(Object.fromEntries(params)),
                      '_blank',
                    );

                    if (!result) {
                      console.error('Read only item could not be opened');
                    }
                  },
                  label:
                    isMineAndInCurrentOrg || isLibraryRoute
                      ? messages.readOnlyOpenInEditor
                      : messages.readOnlyAddToSketches,
                },
                secondary: {
                  onClick: (): void => {
                    const headerItemId = isLibraryRoute
                      ? HeaderItemId.CustomLibrary
                      : isExampleSketchRoute
                      ? HeaderItemId.Example
                      : HeaderItemId.Sketch;

                    headerActions[headerItemId]?.Download();
                  },
                  label: messages.readOnlyDownloadAction,
                },
              }
            : {};

        const ownerName = item?.owner || undefined;

        return {
          ownerName,
          ownerLink: isMine && !isPlayStoreApp() ? Config.ID_URL : undefined,
          sketchStats,
          actionButtons,
          showLogo: !visibilityFromUrl.header,
          itemName,
          itemSubtitle: thingDeviceDetails?.name || sketchBoardData?.name,
        };
      };

    const readOnlyBarLogic = useCallback(useReadOnlyBarLogic, [
      allFiles,
      customLibrary,
      example,
      isCreatedSketch,
      isExampleSketchRoute,
      isLibraryRoute,
      isPrivateSketchViewedFromOrg,
      isSketchQueried,
      itemName,
      sketchBoardData?.name,
      sketchData,
      sketchID,
      sketchStats,
      thingDeviceDetails?.name,
      user,
      visibilityFromUrl.header,
    ]);

    return {
      dependentSidenavLogic,
      headerLogic,
      editorPanelLogic,
      toolbarLogic,
      consolePanelLogic,
      dialogSwitchLogic,
      tabTitle: selectedFile?.fileName,
      isFullscreen,
      isHeaderless: headerless,
      isLibraryRoute,
      onboardingLogic,
      genAiBannerLogic,
      visibilityFromUrl,
      readOnlyBarLogic,
      canUseGenAi,
      viewMode,
    };
  };
