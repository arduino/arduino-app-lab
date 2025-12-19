import { Config } from '@cloud-editor-mono/common';
import {
  ga4Emitter,
  isPlayStoreApp,
  NotificationMode,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { SketchData } from '@cloud-editor-mono/infrastructure';
import {
  ApplyPatchAvailability,
  DependentSidenavLogic,
  ExamplesMenuHandlerDictionary,
  FileNameValidationResult,
  GetExampleLinkSearch,
  LibraryMenuHandlerDictionary,
  OnClickApplyFixToSketch,
  OnClickApplySketch,
  OnClickInclude,
  SelectableFileData,
  SidenavExamplesIds,
  SidenavItemId,
  sidenavItems,
  SidenavItemWithId,
  SidenavLibrariesIds,
  SidenavReferenceIds,
  ToastSize,
  ToastType,
  UseExamplesLogic,
  UseFilesLogic,
  UseGenAILogic,
  useI18n,
  UseLibrariesLogic,
  UseReferenceLogic,
  UseSettingsLogic,
  UseSidenavLogic,
  UseSidenavSharedLogic,
} from '@cloud-editor-mono/ui-components';
import {
  DeleteFileHandler,
  RenameFileHandler,
} from '@cloud-editor-mono/ui-components/lib/editor-tabs-bar';
import { PressEvent } from '@react-aria/interactions';
import { useNavigate, useSearch } from '@tanstack/react-location';
import {
  UseMutateFunction,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { debounce, uniqueId } from 'lodash';
import {
  Key,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  usePreferenceObservable,
  usePreferences,
} from '../../../common/hooks/preferences';
import {
  getExamplesByFolder,
  useFavoriteLibraries,
  useGetBoardsList,
  useGetExamples,
  useGetLibraries,
  useGetLibrary,
  useRetrieveExampleFileContents,
} from '../../../common/hooks/queries/builder';
import {
  getCustomLibraryExamplesByFolder,
  useGetCustomLibraries,
  useRetrieveFilesList,
} from '../../../common/hooks/queries/create';
import {
  useClearChat,
  useGenAIChat,
  useGenAiLegalDisclaimer,
} from '../../../common/hooks/queries/genAi';
import { messages } from '../../../common/hooks/queries/messages';
import {
  useGetReferenceCategories,
  useGetReferenceItem,
  useSearchReferenceItem,
} from '../../../common/hooks/queries/reference';
import { AuthContext } from '../../../common/providers/auth/authContext';
import { ThemeContext } from '../../../common/providers/theme/themeContext';
import { EXAMPLES_MATCH_PATH } from '../../../routing/Router';
import {
  CUSTOM_LIBRARY_ID_PARAM,
  EXAMPLE_ID_PARAM,
  NAV_PARAM,
  SearchGenerics,
  SOURCE_LIBRARY_ID_PARAM,
} from '../../../routing/routing.type';
import { useSketchParams } from '../main/hooks/sketch';
import { shouldDisplayAiLimitBanner } from '../main/utils';
import { triggerSurvey } from './survey';

const SIDENAV_SIZE_KEY = 'arduino:editor:sidenav-size';
const GEN_AI_MAX_USER_PROMPT_CHARS = 2500;

type UseSidenavSize = () => {
  setSidenavWidth: UseMutateFunction<void, unknown, number, unknown>;
  sidenavWidth?: number;
};

export const useSidenavWidth: UseSidenavSize =
  function (): ReturnType<UseSidenavSize> {
    const { viewMode } = useSketchParams();

    const queryClient = useQueryClient();

    const { mutate: setSidenavWidth } = useMutation({
      mutationFn: (width: number) => set(SIDENAV_SIZE_KEY, width),
      onSuccess: () => {
        queryClient.invalidateQueries([SIDENAV_SIZE_KEY]);
      },
    });

    const { data: sidenavWidth, isLoading } = useQuery(
      [SIDENAV_SIZE_KEY],
      async () => {
        const data = await get(SIDENAV_SIZE_KEY);
        return data ?? null;
      },
      { refetchOnWindowFocus: false },
    );

    return {
      setSidenavWidth,
      sidenavWidth:
        isLoading || !!viewMode ? undefined : sidenavWidth ?? undefined,
    };
  };

const getExampleLinkSearch = function useGetExampleLinkSearch(
  exampleID: unknown,
  sourceLibraryID: unknown,
  customLibraryID: unknown,
): ReturnType<GetExampleLinkSearch> {
  const search = useSearch();
  return sourceLibraryID !== undefined
    ? {
        [NAV_PARAM]: search[NAV_PARAM],
        [EXAMPLE_ID_PARAM]: exampleID,
        [SOURCE_LIBRARY_ID_PARAM]: sourceLibraryID,
      }
    : customLibraryID !== undefined
    ? {
        [NAV_PARAM]: search[NAV_PARAM],
        [EXAMPLE_ID_PARAM]: exampleID,
        [CUSTOM_LIBRARY_ID_PARAM]: customLibraryID,
      }
    : {
        [NAV_PARAM]: search[NAV_PARAM],
        [EXAMPLE_ID_PARAM]: exampleID,
      };
};

const getCurrentResourceIds = function useGetCurrentResourceIds(): {
  exampleID?: string;
  sourceLibraryID?: string;
  customLibraryID?: string;
} {
  const { exampleID, sourceLibraryID, customLibraryID } = useSketchParams();

  return {
    exampleID,
    sourceLibraryID,
    customLibraryID,
  };
};

const exampleLinkToPath = `${Config.NEW_WINDOW_ORIGIN}${
  Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
}${EXAMPLES_MATCH_PATH}`;

const createSidenavSharedLogic =
  (
    examplesMenuHandlers: ExamplesMenuHandlerDictionary,
    isExampleSketchRoute: boolean,
    bypassOrgHeader: boolean,
    enabled: boolean,
    isErrorExplanationSending: boolean,
    isErrorExplanationStreamSending: boolean,
    stopErrorExplanationGeneration: () => void,
    onPrivateResourceRequestError?: (error: unknown) => void,
    selectedBoard?: string,
    boardName?: string,
    errorFiles?: string[],
  ): UseSidenavSharedLogic =>
  (): ReturnType<UseSidenavSharedLogic> => {
    const { sketchID } = useSketchParams();

    const { acceptLegalDisclaimer, isLegalDisclaimerAccepted } =
      useGenAiLegalDisclaimer();

    const {
      clearChat,
      clearChatConfirm,
      restoreChat,
      isConversationEmpty,
      isClearChatNotificationOpen,
    } = useClearChat();

    const {
      conversation,
      sendTextMessage,
      promptResponseIsLoading,
      conversationIsLoading,
      stopGeneration,
      sketchPlanAction,
      sketchPlanActionIsLoading,
      isSketchPlan,
      isStreamSending,
      actionType,
      onCopyCode,
    } = useGenAIChat(enabled, selectedBoard, boardName, errorFiles);

    return {
      getLibraries: useGetLibraries,
      getLibrary: useGetLibrary,
      getCustomLibrary: useRetrieveFilesList,
      isExampleSketchContext: () => isExampleSketchRoute,
      exampleLinkToPath,
      getExampleLinkSearch,
      onExampleLinkInteract: (e: PressEvent): void => {
        ga4Emitter({
          type: 'EXAMPLE_SELECT',
          payload: {
            action: 'view_code',
            name: e.target.id.split('/').pop() || '',
            sketch_id: sketchID || '',
          },
        });
      },
      getCurrentResourceIds,
      examplesMenuHandlers,
      getExampleFileContents: useRetrieveExampleFileContents,
      getExamplesByFolder,
      getCustomLibraryExamplesByFolder,
      bypassOrgHeader,
      onPrivateResourceRequestError,
      clearChatConfirm,
      clearChat,
      restoreChat,
      isConversationEmpty,
      isClearChatNotificationOpen,
      showMoreInfoLinks: !isPlayStoreApp(),
      history: conversation,
      sendMessage: sendTextMessage,
      triggerSurvey,
      isLoading: conversationIsLoading,
      isSending: promptResponseIsLoading || isErrorExplanationSending,
      stopGeneration: isErrorExplanationSending
        ? stopErrorExplanationGeneration
        : stopGeneration,
      sketchPlanAction,
      sketchPlanActionIsLoading,
      isSketchPlan,
      isStreamSending: isStreamSending || isErrorExplanationStreamSending,
      actionType,
      onCopyCode,
      acceptLegalDisclaimer,
      isLegalDisclaimerAccepted,
    };
  };

const createFilesLogic =
  (
    files: SelectableFileData[],
    isLoading: boolean,
    selectFile: (fileId?: string) => void,
    selectedFileId: string | undefined,
    unsavedFileIds: Set<string> | undefined,
    renameFile: RenameFileHandler,
    deleteFile: DeleteFileHandler,
    newFileAction: (action: Key | null) => void,
    validateFileName: (
      newName: string,
      prevName: string,
      ext: string,
    ) => FileNameValidationResult,
    replaceFileNameInvalidCharacters: (fileName: string) => string,
    isReadOnly: boolean,
  ) =>
  (): ReturnType<UseFilesLogic> => {
    return {
      isLoading,
      files,
      selectedFileId,
      unsavedFileIds,
      newFileAction,
      selectedFileChange: selectFile,
      renameFile,
      deleteFile,
      validateFileName,
      replaceFileNameInvalidCharacters,
      isReadOnly,
    };
  };

const createLibrariesLogic =
  (
    onClickInclude: OnClickInclude,
    pinnedLibraries: SketchData['libraries'] | undefined,
    canModifySketchMetadata: boolean,
    libraryMenuHandlers: LibraryMenuHandlerDictionary,
    enableGetCustomLibraries: boolean,
    hydrateExamplesByPaths: (paths: string[]) => Promise<void>,
    selectedBoard?: string,
    selectedArchitecture?: string,
    initialSelectedTab = SidenavLibrariesIds.Standard,
  ): UseLibrariesLogic =>
  (): ReturnType<UseLibrariesLogic> => ({
    getCustomLibraries: useGetCustomLibraries,
    getFavoriteLibraries: useFavoriteLibraries,
    getBoards: useGetBoardsList,
    selectedBoard,
    selectedArchitecture,
    onClickInclude,
    pinnedLibraries,
    canModifySketchMetadata,
    libraryMenuHandlers,
    enableGetCustomLibraries,
    initialSelectedTab,
    hydrateExamplesByPaths,
  });

const createExamplesLogic =
  (
    hydrateByPaths: (paths: string[]) => Promise<void>,
    initialSelectedTab = SidenavExamplesIds.BuiltIn,
    selectedBoard?: string,
    selectedArchitecture?: string,
  ): UseExamplesLogic =>
  (): ReturnType<UseExamplesLogic> => {
    return {
      getExamples: useGetExamples,
      initialSelectedTab,
      selectedBoard,
      selectedArchitecture,
      hydrateByPaths,
    };
  };

const createReferenceLogic =
  (initialSelectedTab = SidenavReferenceIds.Functions): UseReferenceLogic =>
  (): ReturnType<UseReferenceLogic> => {
    const { sketchID } = useSketchParams();
    const [selectedTab, setSelectedTab] = useState(initialSelectedTab);

    const onSetSelectedTab = useCallback(
      (tab: SidenavReferenceIds): void => {
        setSelectedTab(tab);
        ga4Emitter({
          type: 'REFERENCE_VIEW',
          payload: {
            sketch_id: sketchID || '',
            type: tab.toLowerCase(),
          },
        });
      },
      [setSelectedTab, sketchID],
    );

    return {
      getReferenceCategories: useGetReferenceCategories,
      getReferenceItem: useGetReferenceItem,
      searchReferenceItem: useSearchReferenceItem,
      selectedTab,
      setSelectedTab: onSetSelectedTab,
    };
  };

const createGenAILogic =
  (
    handleGenAiApplyCode: OnClickApplySketch,
    handleGenAiApplyFixToCode: OnClickApplyFixToSketch,
    handleApplyPatchAvailability: ApplyPatchAvailability,
    scrollToLine: (line: number, fileName?: string) => void,
    openGenAIPolicyTermsDialog: () => void,
    errorLines?: number[],
    genAiMessageUsageExceeded?: boolean,
    shouldDisplayAiLimitBanner?: boolean,
    aiMessagesRemaining?: number,
    isAiRestrictionsEnabled?: boolean,
  ) =>
  (): ReturnType<UseGenAILogic> => {
    const { formatMessage } = useI18n();
    const [longPromptToastId, setLongPromptToastId] = useState<string>();

    const onUserInput = debounce((text: string): void => {
      if (text.length === GEN_AI_MAX_USER_PROMPT_CHARS) {
        if (!longPromptToastId) {
          const toastId = uniqueId();
          sendNotification({
            mode: NotificationMode.Toast,
            modeOptions: {
              toastId,
              toastType: ToastType.Passive,
              toastSize: ToastSize.Small,
              onUnmount: (): void => {
                setLongPromptToastId(undefined);
              },
            },
            message: formatMessage(messages.genAIPromptToLong, {
              maxLen: GEN_AI_MAX_USER_PROMPT_CHARS,
            }),
          });

          setLongPromptToastId(toastId);
        }
      }
    }, 300) as (text: string) => void;

    const debouncedOnUserInput = useCallback(onUserInput, [
      formatMessage,
      longPromptToastId,
      onUserInput,
    ]);

    return {
      handleGenAiApplyCode,
      handleGenAiApplyFixToCode,
      handleApplyPatchAvailability,
      scrollToLine,
      errorLines,
      genAiMessageUsageExceeded:
        isAiRestrictionsEnabled && genAiMessageUsageExceeded,
      shouldDisplayAiLimitBanner:
        isAiRestrictionsEnabled && shouldDisplayAiLimitBanner,
      aiMessagesRemaining,
      linksEnabled: !isPlayStoreApp(),
      openGenAIPolicyTermsDialog,
      onUserInput: debouncedOnUserInput,
      maxContentLength: GEN_AI_MAX_USER_PROMPT_CHARS,
    };
  };

const createSettingsLogic =
  (saveAllFiles: () => void, handleOptOut?: () => void): UseSettingsLogic =>
  (): ReturnType<UseSettingsLogic> => {
    const { setPreference, restorePreferences } = usePreferences();
    const themeContext = useContext(ThemeContext);
    return {
      getPreference: usePreferenceObservable,
      setPreference,
      restorePreferences,
      themeContext,
      saveAllFiles,
      handleOptOut,
    };
  };

const SKETCH_EXPLORER_OPEN_KEY = 'arduino:sketch-explorer-open';
export const createUseSidenavLogic = function (
  hide: boolean,
  dependentSidenavLogic: DependentSidenavLogic,
): UseSidenavLogic {
  return function useSidenavLogic(): ReturnType<UseSidenavLogic> {
    const { canUseGenAi, genAiInteractions, aiUserPlan } =
      useContext(AuthContext);
    const {
      handleLibraryInclude,
      handleGenAiApplyCode,
      handleGenAiApplyFixToCode,
      isExampleSketchRoute,
      exampleIsFromLibrary,
      exampleIsFromCustomLibrary,
      pinnedLibraries,
      canModifySketchMetadata,
      examplesMenuHandlers,
      libraryMenuHandlers,
      selectedBoard,
      boardName,
      selectedArchitecture,
      enableGetCustomLibraries,
      saveAllFiles,
      handleOptOut,
      onLibraryUpload,
      isUploadingLibrary,
      bypassOrgHeader,
      onPrivateResourceRequestError,
      explorerFiles,
      unsavedFileIds,
      selectedFile,
      selectFile,
      renameFile,
      deleteFile,
      newFileAction,
      isLoadingFiles,
      validateFileName,
      replaceFileNameInvalidCharacters,
      isReadOnly,
      genAiBannerLogic,
      scrollToLine,
      errorLines,
      isErrorExplanationSending,
      isErrorExplanationStreamSending,
      stopErrorExplanationGeneration,
      errorFiles,
      isAiRestrictionsEnabled,
      handleApplyPatchAvailability,
      openGenAIPolicyTermsDialog,
      hydrateByPaths,
    } = dependentSidenavLogic();
    const navigate = useNavigate();
    const search = useSearch<SearchGenerics>();
    const nav = search[NAV_PARAM];

    const [isHidden, setIsHidden] = useState(hide);

    const { isGenAiBannerDismissed, dismissGenAiBanner } = genAiBannerLogic();

    const queryClient = useQueryClient();
    const { mutate: onFileExplorerOpen } = useMutation({
      mutationFn: () => set(SKETCH_EXPLORER_OPEN_KEY, true),
      onSuccess: () => {
        queryClient.invalidateQueries([SKETCH_EXPLORER_OPEN_KEY]);
      },
    });

    const {
      data: sketchExplorerHasBeenOpened,
      isLoading: sketchExplorerHasBeenOpenedIsLoading,
    } = useQuery(
      [SKETCH_EXPLORER_OPEN_KEY],
      async () => {
        const data = await get(SKETCH_EXPLORER_OPEN_KEY);
        return data ?? null;
      },

      { refetchOnWindowFocus: false },
    );

    // Set the active item only if it is a valid sidenav item. If not, set the active item to undefined
    let activeItemId: SidenavItemId | undefined = Object.keys(SidenavItemId)
      .filter((key) => (!canUseGenAi ? key !== SidenavItemId.GenAI : true))
      .find((id) => isEqualCaseInsensitive(id, nav)) as
      | SidenavItemId
      | undefined;

    if (nav && !activeItemId) {
      activeItemId = undefined;
    }

    // `navigate` sets state, so it cannot be
    // called during render. It's thus called in a useEffect.
    useEffect(() => {
      if (nav === SidenavItemId.Files) {
        onFileExplorerOpen();
      }

      if (nav === SidenavItemId.GenAI && !isGenAiBannerDismissed) {
        dismissGenAiBanner();
      }

      if (nav && !activeItemId) {
        navigate({ search: { ...search, [NAV_PARAM]: undefined } });
      }
    }, [
      activeItemId,
      dismissGenAiBanner,
      isGenAiBannerDismissed,
      nav,
      navigate,
      onFileExplorerOpen,
      search,
    ]);

    /*
    Split sidenav items into top and bottom sections and set the active item
  */
    const { topSidenavItems, bottomSidenavItems, activeItem } = useMemo(
      function splitItems() {
        return sidenavItems.reduce(
          function splitItem(acc, item) {
            const { position } = item;

            // Set the active item
            if (item.id === activeItemId) {
              item.active = true;
              acc.activeItem = item;
            } else {
              item.active = false;
            }

            // If no position is specified, default to top
            if (position === 'bottom') {
              acc.bottomSidenavItems.push(item);
            } else {
              acc.topSidenavItems.push(item);
            }

            return acc;
          },
          {
            topSidenavItems: [] as SidenavItemWithId[],
            bottomSidenavItems: [] as SidenavItemWithId[],
            activeItem: undefined as SidenavItemWithId | undefined,
          },
        );
      },
      [activeItemId],
    );

    const initialExamplesSelectedTab = exampleIsFromLibrary
      ? SidenavExamplesIds.FromLibraries
      : SidenavExamplesIds.BuiltIn;

    const initialLibrariesSelectedTab = exampleIsFromCustomLibrary
      ? SidenavLibrariesIds.Custom
      : SidenavLibrariesIds.Standard;

    const { sidenavWidth, setSidenavWidth } = useSidenavWidth();

    const disabledItems = ((): SidenavItemId[] => {
      const items = [];

      if (!canUseGenAi) {
        items.push(SidenavItemId.GenAI);
      }

      // In the future we can selectively remove links
      // within the reference. For now we are disabling
      // the entire section.
      if (isPlayStoreApp()) {
        items.push(SidenavItemId.Reference);
      }

      return items;
    })();

    const genAiMessageRemaining =
      genAiInteractions && genAiInteractions.limit - genAiInteractions.usage;

    const genAiMessageUsageExceeded =
      !!genAiMessageRemaining && genAiMessageRemaining <= 0;

    const displayAiLimitBanner =
      !!genAiMessageRemaining &&
      !!aiUserPlan &&
      shouldDisplayAiLimitBanner(aiUserPlan, genAiMessageRemaining);

    return {
      topSidenavItems,
      bottomSidenavItems,
      activeItem: isHidden ? undefined : activeItem,
      sidenavSharedLogic: createSidenavSharedLogic(
        examplesMenuHandlers,
        isExampleSketchRoute,
        bypassOrgHeader,
        !!canUseGenAi,
        isErrorExplanationSending,
        isErrorExplanationStreamSending,
        stopErrorExplanationGeneration,
        onPrivateResourceRequestError,
        selectedBoard,
        boardName,
        errorFiles,
      ),
      contentLogicMap: {
        [SidenavItemId.Files]: createFilesLogic(
          explorerFiles,
          isLoadingFiles,
          selectFile,
          selectedFile?.fileId,
          unsavedFileIds,
          renameFile,
          deleteFile,
          newFileAction,
          validateFileName,
          replaceFileNameInvalidCharacters,
          isReadOnly,
        ),
        [SidenavItemId.Examples]: createExamplesLogic(
          hydrateByPaths,
          initialExamplesSelectedTab,
          selectedBoard,
          selectedArchitecture,
        ),
        [SidenavItemId.Libraries]: createLibrariesLogic(
          handleLibraryInclude,
          pinnedLibraries,
          canModifySketchMetadata || false,
          libraryMenuHandlers,
          enableGetCustomLibraries,
          hydrateByPaths,
          selectedBoard,
          selectedArchitecture,
          initialLibrariesSelectedTab,
        ),
        [SidenavItemId.Reference]: createReferenceLogic(),
        [SidenavItemId.GenAI]: createGenAILogic(
          handleGenAiApplyCode,
          handleGenAiApplyFixToCode,
          handleApplyPatchAvailability,
          scrollToLine,
          openGenAIPolicyTermsDialog,
          errorLines,
          genAiMessageUsageExceeded,
          displayAiLimitBanner,
          genAiMessageRemaining,
          isAiRestrictionsEnabled,
        ),
        [SidenavItemId.Settings]: createSettingsLogic(
          saveAllFiles,
          handleOptOut,
        ),
      },
      headerLogicMap: {
        [SidenavItemId.Files]: () => null,
        [SidenavItemId.Examples]: () => null,
        [SidenavItemId.Libraries]: () => ({
          isUploadingLibrary,
          onLibraryUpload,
        }),
        [SidenavItemId.GenAI]: () => null,
        [SidenavItemId.Reference]: () => null,
        [SidenavItemId.Settings]: () => null,
      },
      sectionKey:
        activeItem?.id &&
        {
          [SidenavItemId.Files]: undefined,
          [SidenavItemId.Examples]: `${initialExamplesSelectedTab}|${selectedBoard}|${selectedArchitecture}`,
          [SidenavItemId.Libraries]: `${initialLibrariesSelectedTab}|${selectedBoard}|${selectedArchitecture}`,
          [SidenavItemId.GenAI]: `${sidenavWidth}`,
          [SidenavItemId.Reference]: undefined,
          [SidenavItemId.Settings]: undefined,
        }[activeItem.id],
      onInteract: (): void => {
        setIsHidden(false);
      },
      disabledItems: disabledItems,
      initialSidenavWidth: sidenavWidth,
      onSizeChange: setSidenavWidth,
      isGenAiBannerDismissed,
      sketchExplorerHasBeenOpened:
        nav === SidenavItemId.Files ||
        sketchExplorerHasBeenOpened ||
        sketchExplorerHasBeenOpenedIsLoading,
    };
  };
};

function isEqualCaseInsensitive(a?: string, b?: string): boolean {
  return a?.toLowerCase() === b?.toLowerCase();
}
