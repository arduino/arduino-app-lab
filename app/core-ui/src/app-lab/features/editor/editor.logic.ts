import {
  codeInjectionsSubjectNext,
  codeSubjectNext,
  getBrickDetails,
  getBrowser,
  getCodeInjectionsSubject,
  getCodeSubjectById,
  getFileContent,
  getUnsavedFilesSubject,
  openLinkExternal,
  replaceFileNameInvalidCharacters,
  saveAppFile,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { BrickInstance } from '@cloud-editor-mono/infrastructure';
import {
  BrickDetailLogic,
  CodeEditorLogic,
  EditorControlsProps,
  EditorPanelLogic,
  mapAssetSources,
  SelectableFileData,
  TabsBarLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  Preferences,
  SecretsEditorLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { EditorView } from '@codemirror/view';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  getSelectedCodeObservableValue,
  useCodeChange,
  useCodeInjectionsObservable,
} from '../../../common/hooks/code';
import {
  codeEditorViewInstance,
  useCodeEditorViewInstance,
} from '../../../common/hooks/editor';
import { SKETCH_SECRETS_FILE_ID } from '../../../common/hooks/files';
import { usePreferenceObservable } from '../../../common/hooks/preferences';
import { UseCreateSketchFromExisting } from '../../../common/hooks/queries/create.type';
import { getAppLabFileIcon } from '../../../common/utils';
import { EditorLogicParams } from './editor.type';

function getDataFromFile(
  file?: SelectableFileData,
  appPath?: string,
): () => string | undefined {
  const selectedFileValue = getSelectedCodeObservableValue(
    getCodeSubjectById,
    file?.fileId,
  )?.value;

  if (file?.fileExtension === 'md') {
    return () =>
      mapAssetSources(
        selectedFileValue,
        (path) => '/file-content-assets/' + path,
        appPath,
      );
  }
  return () => selectedFileValue;
}

type UseEditorLogic = (editorLogic: EditorLogicParams) => {
  editorPanelLogic: EditorPanelLogic;
};

export const useEditorLogic: UseEditorLogic = function (
  editorLogicParams: EditorLogicParams,
) {
  const {
    appBricks,
    appPath,
    selectedFile,
    selectFile,
    closeFile,
    updateOpenFilesOrder,
    addAppFile,
    deleteAppFile,
    renameAppFile,
    updateAppBrick,
    initialAppBrickTab,
    sketchDataIsLoading,
    selectableMainFile,
    unsavedFileIds,
    openFiles: tabs,
    readOnly,
  } = editorLogicParams;

  const [shouldRenderMarkdown, setShouldRenderMarkdown] = useState(true);

  const useTabsBarLogic = (): ReturnType<TabsBarLogic> => {
    const browser = getBrowser();
    const hasSetHeightOnHover = Boolean(
      browser?.includes('Safari') ||
        browser?.includes('Opera') ||
        browser?.includes('Chrome') ||
        browser?.includes('Edge') ||
        browser?.includes('WebKit'),
    );

    const selectSecretsTab = useCallback(() => {
      selectFile(SKETCH_SECRETS_FILE_ID);
    }, []);

    const validateFileName = useCallback(() => [], []);

    const makeUniqueFileName = useCallback((fileName: string): string => {
      return fileName;
    }, []);

    return {
      tabs,
      selectableMainFile,
      selectedTab: selectedFile,
      selectTab: selectFile,
      selectSecretsTab,
      closeTab: closeFile,
      updateTabOrder: updateOpenFilesOrder,
      sketchDataIsLoading, // ??
      unsavedFileIds,
      isReadOnly: true,
      isExampleSketchRoute: false,
      hasSetHeightOnHover,
      validateFileName,
      makeUniqueFileName,
      addFile: addAppFile,
      renameFile: renameAppFile,
      deleteFile: deleteAppFile,
      replaceFileNameInvalidCharacters,
      getFileIcon: getAppLabFileIcon,
      isRenderedMarkdownFile:
        (selectedFile?.fileExtension === 'md' && shouldRenderMarkdown) ||
        selectedFile?.fileExtension === 'brick',
    };
  };

  const tabsBarLogic = useCallback(useTabsBarLogic, [
    tabs,
    selectableMainFile,
    selectedFile,
    selectFile,
    closeFile,
    updateOpenFilesOrder,
    sketchDataIsLoading,
    unsavedFileIds,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    shouldRenderMarkdown,
  ]);

  const { mutateAsync: saveSketchFileQuery } = useMutation({
    mutationFn: async (payload?: {
      fileId?: string;
      code?: string;
      hash?: string;
    }) => {
      if (!payload || !payload.fileId || !payload.code) {
        return Promise.reject(new Error('No payload provided'));
      }

      const { fileId: path, code: content } = payload;
      try {
        await saveAppFile(`${appPath}/${path}`, content);
      } catch (error) {
        return Promise.reject(
          new Error(`Failed to save sketch file: ${error}`),
        );
      }
      return null;
    },
  });

  const updateCodeSubjectHash = useCallback(async () => undefined, []);

  const useCreateSketchFromExisting =
    (): ReturnType<UseCreateSketchFromExisting> => ({
      create: async () => undefined,
      isLoading: false,
    });

  const createSketchFromExisting = useCallback(useCreateSketchFromExisting, []);

  const retrieveSketches = useCallback(async () => [], []);

  const { setCode, saveCode } = useCodeChange(
    saveSketchFileQuery,
    selectFile,
    codeInjectionsSubjectNext,
    getCodeSubjectById,
    codeSubjectNext,
    getUnsavedFilesSubject,
    updateCodeSubjectHash,
    createSketchFromExisting,
    retrieveSketches,
    false,
    false,
    readOnly,
    selectedFile,
    selectableMainFile,
    undefined,
    undefined,
    tabs,
  );

  useCodeEditorViewInstance(selectFile, tabs);

  const onReceiveViewInstance = useCallback(
    (viewInstance: EditorView | null): void => {
      codeEditorViewInstance.instance = viewInstance;
    },
    [],
  );

  const useCodeEditorLogic = (): ReturnType<CodeEditorLogic> => {
    useCodeInjectionsObservable(getCodeInjectionsSubject);

    const isReadonlyFile = (selectedFile?: SelectableFileData): boolean => {
      const readonlyFiles = ['app.yaml', 'sketch/sketch.yaml'];
      if (!selectedFile) return false;

      return readonlyFiles.includes(selectedFile?.fileId);
    };

    return {
      setCode,
      sketchDataIsLoading,
      getCode: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, selectedFile?.fileId)
          ?.value,
      getCodeExt: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, selectedFile?.fileId)
          ?.meta.ext,
      getCodeInstanceId: () =>
        getSelectedCodeObservableValue(getCodeSubjectById, selectedFile?.fileId)
          ?.meta.instanceId,
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
      codeInstanceIds: tabs
        .map(
          (t) =>
            getSelectedCodeObservableValue(getCodeSubjectById, t.fileId)?.meta
              .instanceId,
        )
        .filter((id): id is string => Boolean(id)),
      onReceiveViewInstance,
      fontSize: Number(usePreferenceObservable(Preferences.FontSize)),
      readOnly: readOnly || isReadonlyFile(selectedFile),
      showReadOnlyBanner: readOnly && !isReadonlyFile(selectedFile),
      hasHeader: false,
      hasTabs: true,
      gutter: readOnly ? undefined : { lineNumberStartOffset: 0 },
    };
  };

  const codeEditorLogic = useCallback(useCodeEditorLogic, [
    onReceiveViewInstance,
    readOnly,
    saveCode,
    selectedFile,
    setCode,
    sketchDataIsLoading,
    tabs,
  ]);

  const useSecretsEditorLogic = (): ReturnType<SecretsEditorLogic> => {
    const updateSecrets = useCallback(async (): Promise<void> => {}, []);

    const openDeleteSecretDialog = useCallback((): void => {}, []);

    return {
      secrets: undefined,
      updateSecrets,
      openDeleteSecretDialog,
    };
  };

  const secretsEditorLogic = useCallback(useSecretsEditorLogic, []);

  const openExternalLink = useCallback((url: string) => {
    if (!url) {
      console.warn('No URL provided to open externally');
      return;
    }
    openLinkExternal(url);
  }, []);

  const useBrickDetailLogic = (): ReturnType<BrickDetailLogic> => {
    const loadBrickInstance = useCallback(
      (brickId: string): Promise<BrickInstance> => {
        const brick = appBricks?.find((b) => b.id === brickId);
        return brick ? Promise.resolve(brick) : Promise.reject();
      },
      [appBricks],
    );

    return {
      initialTab: initialAppBrickTab,
      showConfigure: !readOnly,
      loadBrickDetails: getBrickDetails,
      loadBrickInstance,
      loadFileContent: getFileContent,
      onOpenExternalLink: openExternalLink,
      updateBrickDetails: updateAppBrick,
    };
  };

  const brickDetailLogic = useCallback(useBrickDetailLogic, [
    appBricks,
    initialAppBrickTab,
    openExternalLink,
    readOnly,
    updateAppBrick,
  ]);

  const useEditorPanelLogic = (): ReturnType<EditorPanelLogic> => {
    const controlsProps = {
      hideControls: true,
    } as EditorControlsProps;

    return {
      tabsBarLogic,
      codeEditorLogic,
      secretsEditorLogic,
      brickDetailLogic,
      selectedFile: selectedFile
        ? {
            id: selectedFile.fileId,
            ext: selectedFile.fileExtension,
            getData: getDataFromFile(selectedFile, appPath),
          }
        : undefined,
      ...controlsProps,
      isFullscreen: false,
      codeIsFormatting: false,
      isConcurrent: false,
      hideTabs: false,
      shouldRenderMarkdown,
      markdownCanBeRendered: true,
      setShouldRenderMarkdown,
      openExternalLink,
      canSwitchMarkdownMode: !(
        selectedFile?.fileId && unsavedFileIds?.has(selectedFile?.fileId)
      ),
      readOnly,
    };
  };

  const editorPanelLogic = useCallback(useEditorPanelLogic, [
    tabsBarLogic,
    codeEditorLogic,
    secretsEditorLogic,
    brickDetailLogic,
    selectedFile,
    appPath,
    shouldRenderMarkdown,
    openExternalLink,
    unsavedFileIds,
    readOnly,
  ]);

  return {
    editorPanelLogic,
  };
};
