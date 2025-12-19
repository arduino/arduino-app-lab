import { Config } from '@cloud-editor-mono/common';
import {
  FILE_NAME_LENGTH_LIMIT,
  getCodeSubjectById,
  retrieveSketches,
  validateFileNameFormat,
  validateFileNameLimit,
} from '@cloud-editor-mono/domain';
import {
  FileNameValidation,
  FileNameValidationItem,
  useI18n,
} from '@cloud-editor-mono/ui-components';
import {
  NewTabMenuItemIds,
  OnBeforeFileAction,
  TabMenuItemIds,
} from '@cloud-editor-mono/ui-components/lib/editor-tabs-bar';
import { useMatch } from '@tanstack/react-location';
import { useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocation as reactUse_useLocation } from 'react-use';

import { useEditExampleNotification } from '../../../../common/hooks/notifications';
import { useCreateSketchFromExisting } from '../../../../common/hooks/queries/create';
import { NotificationsContext } from '../../../../common/providers/notifications/notificationsContext';
import {
  EXAMPLES_MATCH_PATH,
  LIBRARIES_MATCH_PATH,
  MAIN_PATH,
  notFoundRouteMap,
  SUB_ROUTE_STRINGS,
} from '../../../../routing/Router';
import {
  BYPASS_IOT_REDIRECT,
  BYPASS_OPT_IN,
  CREATE_EXAMPLE_PARAM,
  CREATE_SKETCH_PARAM,
  CUSTOM_LIBRARY_ID_PARAM,
  EXAMPLE_ID_PARAM,
  getLineNumbersFromHighlightValue,
  getStartEndFromScope,
  HIDE_NUMBERS_PARAM,
  HIGHLIGHT_PARAM,
  isHighlightValue,
  isScopeValue,
  isViewModeValue,
  LIBRARY_ID_PARAM,
  NotFoundType,
  SCOPE_PARAM,
  SKETCH_ID_ROUTE_PARAM,
  SOURCE_LIBRARY_ID_PARAM,
  VIEW_MODE_PARAM,
} from '../../../../routing/routing.type';
import { UseFileHandlers, UseSketchParams } from '../main.type';
import { invalidFileNameMessages } from '../messages';

export enum SketchBroadcastEvent {
  SKETCH_UPDATE = 'sketch-update',
  SKETCH_DELETE = 'sketch-delete',
}

export const useSketchParams = function (): ReturnType<UseSketchParams> {
  const route = useMatch() || {};
  const { params: { [SKETCH_ID_ROUTE_PARAM]: sketchID } = {} } = route;

  const { value: isSketchRouteWithUsername, sketchId: extractedSketchId } =
    useIsSketchRouteWithUsername();

  const isSketchQueried =
    (!!sketchID && sketchID !== '/') || !!extractedSketchId;

  // ** `useMatch` result can be stale during some render cycles
  // ** this block is using `reactUse_useLocation` to deduce the "sketch id",
  // ** the `sketchIDInUrl` deduced is later compared with the result from `useMatch`
  // ** if they are different, we know the url has updated but `useMatch`
  // ** result is stale, thus `sketchIDIsLoading === true`
  // ! this is a workaround, that should be redundant once we move
  // ! away from `react-location`
  const loc = reactUse_useLocation();

  const locPaths = loc.pathname?.split('/');

  const basePathIndex = locPaths?.indexOf(Config.ROUTING_BASE_URL);
  const pathWildcard =
    basePathIndex !== undefined ? locPaths?.[basePathIndex + 1] : undefined;

  const sketchIDInUrl =
    pathWildcard && SUB_ROUTE_STRINGS.includes(pathWildcard)
      ? undefined
      : pathWildcard;

  const params = new URLSearchParams(window.location.search);

  const viewModeParam = params.get(VIEW_MODE_PARAM);
  const viewMode =
    viewModeParam && isViewModeValue(viewModeParam) ? viewModeParam : undefined;

  const scopeParam =
    viewMode && viewMode !== 'preview' ? params.get(SCOPE_PARAM) : undefined;
  const scope = useMemo(
    () =>
      scopeParam && isScopeValue(scopeParam)
        ? getStartEndFromScope(scopeParam)
        : undefined,
    [scopeParam],
  );

  const highlightParam =
    viewMode && viewMode !== 'preview'
      ? params.get(HIGHLIGHT_PARAM)
      : undefined;
  const highlight = useMemo(
    () =>
      highlightParam && isHighlightValue(highlightParam)
        ? getLineNumbersFromHighlightValue(highlightParam).filter(
            (n) => !scope || (n >= scope.start && n <= scope.end),
          )
        : undefined,
    [highlightParam, scope],
  );

  const hideNumbers = params.get(HIDE_NUMBERS_PARAM);

  return {
    isSketchQueried,
    sketchID: isSketchQueried
      ? isSketchRouteWithUsername && extractedSketchId
        ? extractedSketchId
        : sketchID
      : undefined,
    sketchIDIsLoading:
      isSketchRouteWithUsername && extractedSketchId
        ? !extractedSketchId
        : Boolean(sketchIDInUrl && sketchIDInUrl !== sketchID),
    libraryID: params.get(LIBRARY_ID_PARAM) || undefined,
    sourceLibraryID: params.get(SOURCE_LIBRARY_ID_PARAM) || undefined,
    customLibraryID: params.get(CUSTOM_LIBRARY_ID_PARAM) || undefined,
    exampleID: params.get(EXAMPLE_ID_PARAM) || undefined,
    createExampleParam: Boolean(params.get(CREATE_EXAMPLE_PARAM)),
    createSketchParam: Boolean(params.get(CREATE_SKETCH_PARAM)),
    bypassOptIn: Boolean(params.get(BYPASS_OPT_IN)),
    bypassIotRedirect: Boolean(params.get(BYPASS_IOT_REDIRECT)),
    viewMode,
    scope,
    highlight: highlight && highlight.length > 0 ? highlight : undefined,
    hideNumbers: typeof hideNumbers === 'string' && hideNumbers !== 'false',
  };
};

export const useOpenSketchInNewWindow = function (sketchID?: string): void {
  useEffect(() => {
    if (!sketchID) return;

    const url = new URL(sketchID, MAIN_PATH);

    const result = window.open(url);

    if (!result) {
      throw new Error('New sketch could not be opened in new window');
    }
  }, [sketchID]);
};

export const useFileHandlers: UseFileHandlers = function (
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
  exampleInoData,
  exampleFilesData,
): ReturnType<UseFileHandlers> {
  const { formatMessage } = useI18n();
  const { sendErrorNotification } = useContext(NotificationsContext);

  const sketchBasePath = mainInoFile?.fileId?.replace(
    mainInoFile?.fileFullName || '',
    '',
  );

  const isExampleSketchRoute = useIsExampleRoute();
  const { send: sendCopyExampleNotification } = useEditExampleNotification(
    getCodeSubjectById,
    useCreateSketchFromExisting,
    retrieveSketches,
    exampleInoData,
  );

  const onBeforeFileAction: OnBeforeFileAction = useCallback(
    (_: NewTabMenuItemIds | TabMenuItemIds) => {
      if (isExampleSketchRoute && exampleInoData) {
        sendCopyExampleNotification(exampleInoData, exampleFilesData);

        return {
          bypassDefault: true,
        };
      }

      return {
        bypassDefault: isExampleSketchRoute,
      };
    },
    [
      exampleFilesData,
      exampleInoData,
      isExampleSketchRoute,
      sendCopyExampleNotification,
    ],
  );

  const validateFileName = useCallback(
    (prevName: string, newName: string, extension: string) => {
      const items: FileNameValidationItem[] = [];

      const pushItem = (
        id: FileNameValidation,
        type: 'error' | 'warning',
      ): void => {
        const message = formatMessage(invalidFileNameMessages[id]);
        items.push({ id, message, type });
      };

      const alreadyExists = editorFiles.some(
        (file) =>
          file.fileFullName !== `${prevName}.${extension}` &&
          file.fileName === newName &&
          file.fileExtension === extension,
      );

      if (newName === '') {
        pushItem(FileNameValidation.emptyName, 'error');
      }
      if (alreadyExists) {
        pushItem(FileNameValidation.alreadyExists, 'error');
      }
      if (validateFileNameLimit(newName)) {
        pushItem(FileNameValidation.exceedsLimit, 'warning');
      }
      if (validateFileNameFormat(newName)) {
        pushItem(FileNameValidation.hasInvalidCharacters, 'warning');
      }

      return items;
    },
    [editorFiles, formatMessage],
  );

  const makeUniqueFileName = useCallback(
    (fileName: string, fileExtension: string): string => {
      const checkExtension = fileExtension !== '';
      const validFileName = fileName.slice(0, FILE_NAME_LENGTH_LIMIT);

      function getNextName(counter = -1): string {
        const fileName =
          counter === -1 ? validFileName : `${validFileName}-${counter}`;

        const hasDuplicate =
          editorFiles.findIndex((f) => {
            return checkExtension
              ? f.fileFullName.toLocaleLowerCase() ===
                  `${fileName}.${fileExtension}`.toLocaleLowerCase()
              : f.fileName.toLocaleLowerCase() === fileName.toLocaleLowerCase();
          }) !== -1;

        if (!hasDuplicate) {
          return fileName;
        }

        return getNextName(counter + 1);
      }

      return getNextName();
    },
    [editorFiles],
  );

  const renameFileHandler = useCallback(
    async (fileId: string, newName: string): Promise<void> => {
      const file = editorFiles.find((f) => f.fileId === fileId);
      const newFileId = `${sketchBasePath}${newName}.${file?.fileExtension}`;
      try {
        updateOpenFile(fileId, newFileId);
        await renameSketchFile(fileId, newFileId);
      } catch {
        updateOpenFile(newFileId, fileId);
        sendErrorNotification();
      }
    },
    [
      editorFiles,
      renameSketchFile,
      sendErrorNotification,
      sketchBasePath,
      updateOpenFile,
    ],
  );

  const addFileHandler = useCallback(
    async (
      fileId: string,
      fileName: string,
      fileExtension: string,
      code?: string,
    ) => {
      const prevSelectedFileId = selectedFile?.fileId;
      selectFile(fileId);
      try {
        await addSketchFile(fileId, fileName, fileExtension, code);
      } catch {
        if (prevSelectedFileId) {
          selectFile(prevSelectedFileId);
        }
        sendErrorNotification();
      }
    },
    [addSketchFile, selectFile, selectedFile?.fileId, sendErrorNotification],
  );

  const deleteFileHandler = useCallback(
    async (fileId: string) => {
      const fileIndex = openFiles.findIndex((f) => f.fileId === fileId);
      try {
        closeFile(fileId);
        await deleteSketchFile(fileId);
      } catch {
        selectFile(fileId, fileIndex);
      }
    },
    [closeFile, deleteSketchFile, openFiles, selectFile],
  );

  return {
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    onBeforeFileAction,
    validateFileName,
    makeUniqueFileName,
  };
};

type UseIsSketchRouteWithUsername = () => {
  value: boolean;
  username: string;
  sketchId: string;
};

export const useIsSketchRouteWithUsername =
  (): ReturnType<UseIsSketchRouteWithUsername> => {
    const loc = reactUse_useLocation();

    const url = `${Config.APP_ORIGIN}${
      Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
    }/`;

    const value = Boolean(loc.href?.replace(url, '').split('/').length === 2);

    return {
      value,
      username: value ? loc.href?.replace(url, '').split('/')[0] || '' : '',
      sketchId: value ? loc.href?.replace(url, '').split('/')[1] || '' : '',
    };
  };

type UseIsExampleRoute = () => boolean;

export const useIsExampleRoute = (): ReturnType<UseIsExampleRoute> => {
  const loc = reactUse_useLocation();

  const url = `${Config.APP_ORIGIN}${
    Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
  }${EXAMPLES_MATCH_PATH}`;

  return Boolean(loc.href?.startsWith(url));
};

type UseIsLibraryRoute = () => boolean;

export const useIsLibraryRoute = (): ReturnType<UseIsLibraryRoute> => {
  const loc = reactUse_useLocation();

  const url = `${Config.APP_ORIGIN}${
    Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
  }${LIBRARIES_MATCH_PATH}`;

  return Boolean(loc.href?.startsWith(url));
};

type UseIsNotFoundRoute = () => boolean;

export const useIsNotFoundRoute = (): ReturnType<UseIsNotFoundRoute> => {
  const loc = reactUse_useLocation();

  const getUrl = (type: NotFoundType): string =>
    `${Config.APP_ORIGIN}${
      Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
    }${notFoundRouteMap[type]}`;

  return (
    Boolean(loc.href?.startsWith(getUrl('Sketch'))) ||
    Boolean(loc.href?.startsWith(getUrl('Example'))) ||
    Boolean(loc.href?.startsWith(getUrl('Library')))
  );
};
