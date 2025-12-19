import { Config } from '@cloud-editor-mono/common';
import {
  ga4Emitter,
  getNewWindow,
  isPrivateResourceRequestWithOrgIdError,
  MalformedLibrary,
  NotificationMode,
  NotificationType,
  RetrieveLibraryFileContentsResult,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { GetFile_ResponseWithName } from '@cloud-editor-mono/infrastructure';
import {
  LibraryMenuHandlersIds,
  SidenavCustomLibrary,
  SidenavItemId,
  SidenavStandardLibrary,
  ToastSize,
  ToastType,
} from '@cloud-editor-mono/ui-components';
import { defaultStringifySearch, useNavigate } from '@tanstack/react-location';
import { QueryKey } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IntlContext, MessageDescriptor } from 'react-intl';

import { useMessage } from '../../../../common/hooks/messages/broadcastChannel';
import { useActionFailuresHandler } from '../../../../common/hooks/queries/actions';
import {
  downloadLibrary as downloadBuilderLibrary,
  useGetLibrary,
  useRetrieveLibraryFilesContents,
} from '../../../../common/hooks/queries/builder';
import {
  BatchFile,
  downloadLibrary as downloadCreateLibrary,
  isCustomLibrary,
  useGetCustomLibraries,
  useImportLibrary,
  useRetrieveBatchFileContents,
  useRetrieveFilesList,
  useSaveCustomLibrary,
} from '../../../../common/hooks/queries/create';
import { refreshCustomLibraries } from '../../../../common/hooks/queries/createUtils';
import { AuthContext } from '../../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../../common/providers/component/componentContext';
import { useDialog } from '../../../../common/providers/dialog/dialogProvider.logic';
import { getMainLibraryFile } from '../../../../common/utils';
import { LIBRARIES_MATCH_PATH } from '../../../../routing/Router';
import {
  LIBRARY_ID_PARAM,
  NAV_PARAM,
  SOURCE_LIBRARY_ID_PARAM,
} from '../../../../routing/routing.type';
import { DialogId, DialogInfo } from '../../dialog-switch';
import { UseGetLibrariesQueries } from '../main.type';
import { messages } from '../messages';
import { isCustomLibAccessedFromSharedSpaceError } from '../utils';
import { useNotFound } from './routing';
import { useSketchParams } from './sketch';

export enum CustomLibraryBroadcastEvent {
  CUSTOM_LIBRARY_CREATE = 'custom-library-create',
  CUSTOM_LIBRARY_DELETE = 'custom-library-delete',
}

export const useGetLibrariesQueries: UseGetLibrariesQueries = function (
  userWasAuthenticated: boolean,
  isLibraryRoute: boolean,
): ReturnType<UseGetLibrariesQueries> {
  const { user } = useContext(AuthContext);
  const { isIotComponent } = useContext(ComponentContext);
  const [bypassOrgHeader, setBypassOrgHeader] = useState(false);

  const { sourceLibraryID, libraryID, sketchID, viewMode, scope, exampleID } =
    useSketchParams();

  const navigate = useNavigate();

  useNotFound(
    userWasAuthenticated && isLibraryRoute && !libraryID && !sourceLibraryID,
    'Library',
  );

  const { formatMessage } = useContext(IntlContext);

  // "sourceLibraryID" is also a parameter when an example of a source library is opened.
  // In this case, we shouldn't create a custom library from the source library.
  const createCustomLibraryFromSource = Boolean(sourceLibraryID) && !exampleID;

  const { customLibraries, customLibrariesAreLoading } = useGetCustomLibraries(
    userWasAuthenticated && isLibraryRoute,
  );

  const { setDialogInfo, setIsOpen } = useDialog<DialogInfo>();

  // Handle creating a new custom library from a source library
  const { send } = useMessage(
    CustomLibraryBroadcastEvent.CUSTOM_LIBRARY_CREATE,
    refreshCustomLibraries,
  );
  useMessage(CustomLibraryBroadcastEvent.CUSTOM_LIBRARY_DELETE, (message) => {
    const deletedCustomLibraryID = message.data as string;
    if (deletedCustomLibraryID && deletedCustomLibraryID === libraryID) {
      window.location.href = `${Config.CLOUD_HOME_URL}/sketches`;
    } else {
      refreshCustomLibraries();
    }
  });

  const { library: sourceLibrary } = useGetLibrary(
    {
      id: sourceLibraryID as string,
    },
    isLibraryRoute && createCustomLibraryFromSource,
  );

  const customLibraryFromSource = useMemo(
    () => customLibraries?.find((lib) => lib.name === sourceLibrary?.name),
    [customLibraries, sourceLibrary?.name],
  );

  const prepareAndSaveCustomLibrary =
    userWasAuthenticated &&
    createCustomLibraryFromSource &&
    Boolean(sourceLibrary);

  useEffect(() => {
    // in case the users follows a url with an slid, from which we have
    // already created a custom lib, we redirect to the custom lib
    if (
      isLibraryRoute &&
      prepareAndSaveCustomLibrary &&
      customLibraryFromSource
    ) {
      navigate({
        search: {
          [LIBRARY_ID_PARAM]: customLibraryFromSource.id,
          [SOURCE_LIBRARY_ID_PARAM]: undefined,
          [NAV_PARAM]: SidenavItemId.Libraries,
        },
        replace: true,
      });
    }
  }, [
    customLibraryFromSource,
    isLibraryRoute,
    navigate,
    prepareAndSaveCustomLibrary,
  ]);

  const releaseId = `${sourceLibrary?.id}@${sourceLibrary?.version}`;
  const targetName = sourceLibrary?.name ?? sourceLibrary?.id; // "PubSubClient" without version (we need this to open files)
  const { saveLibraryQuery } = useSaveCustomLibrary(
    targetName,
    prepareAndSaveCustomLibrary &&
      !customLibrariesAreLoading &&
      !customLibraryFromSource,
    releaseId,
  );

  const onLibraryFilesFetched = useCallback(
    async (data: RetrieveLibraryFileContentsResult[]) => {
      await saveLibraryQuery(data);
      send(CustomLibraryBroadcastEvent.CUSTOM_LIBRARY_CREATE);
    },
    [saveLibraryQuery, send],
  );

  useRetrieveLibraryFilesContents(
    prepareAndSaveCustomLibrary &&
      !customLibrariesAreLoading &&
      !customLibraryFromSource,
    sourceLibrary,
    onLibraryFilesFetched,
  );

  // Handle retrieving a custom library and its files by its ID
  const customLibrary = useMemo(
    () => customLibraries?.find((lib) => lib.id === libraryID),
    [customLibraries, libraryID],
  );
  const handleCustomLibrary = Boolean(libraryID) && Boolean(customLibrary);

  const onPrivateResourceRequestError = useCallback(
    (error: unknown): { errorIsManaged: boolean } => {
      if (!isLibraryRoute || !error) {
        return { errorIsManaged: false };
      }

      if (
        isPrivateResourceRequestWithOrgIdError(error, (errCause) => {
          return isCustomLibAccessedFromSharedSpaceError(errCause, user);
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
    [bypassOrgHeader, isLibraryRoute, user],
  );

  const filesListKey: QueryKey = useMemo(
    () => ['get-files-list', customLibrary?.path, String(bypassOrgHeader)],
    [bypassOrgHeader, customLibrary?.path],
  );
  const { filesList } = useRetrieveFilesList(
    filesListKey,
    userWasAuthenticated && handleCustomLibrary && Boolean(customLibrary?.path),
    bypassOrgHeader,
    onPrivateResourceRequestError,
    customLibrary?.path,
    true,
  );

  const [mainLibraryFile, setMainLibraryFile] = useState<
    GetFile_ResponseWithName | undefined
  >();
  const [mainLibraryFileArray, setMainLibraryFileArray] = useState<
    BatchFile[] | undefined
  >();

  useEffect(() => {
    const mainFile = filesList ? getMainLibraryFile(filesList) : undefined;

    setMainLibraryFile(mainFile);
    setMainLibraryFileArray(mainFile ? [mainFile] : undefined);
  }, [filesList]);

  const {
    filesContents: customLibraryFilesContents,
    isLoading: customLibraryFilesAreLoading,
    allContentsRetrieved,
  } = useRetrieveBatchFileContents(
    userWasAuthenticated && handleCustomLibrary && Boolean(filesList),
    bypassOrgHeader,
    filesListKey,
    onPrivateResourceRequestError,
    undefined,
    viewMode === 'snippet' && mainLibraryFileArray
      ? mainLibraryFileArray
      : filesList,
    customLibrary?.path,
    true,
    scope,
    mainLibraryFile?.path,
    true,
  );

  // Library item menu handlers
  const libraryMenuHandlers = useMemo(
    () => ({
      [LibraryMenuHandlersIds.Modify]: (
        library: SidenavStandardLibrary | SidenavCustomLibrary,
      ): void => {
        if (!library.id) {
          throw new Error('Cannot modify a custom library without an ID');
        }

        ga4Emitter({
          type: 'LIBRARY_SELECT',
          payload: {
            action: 'modify_library',
            sketch_id: sketchID || '',
            name: library.name || '',
          },
        });

        const URL = `${
          Config.ROUTING_BASE_URL ? `${Config.ROUTING_BASE_URL}` : ''
        }${LIBRARIES_MATCH_PATH}`;

        const search = {
          [LIBRARY_ID_PARAM]: library.id,
          [NAV_PARAM]: SidenavItemId.Libraries,
        };
        if (!isIotComponent) {
          navigate({
            to: URL,
            search,
          });
          return;
        }

        const result = getNewWindow(
          `${Config.NEW_WINDOW_ORIGIN}${URL}`,
          defaultStringifySearch(search),
          '_blank',
        );

        if (!result) {
          throw new Error('Library could not be opened');
        }
      },
      [LibraryMenuHandlersIds.CopyAndModify]: (
        library: SidenavStandardLibrary | SidenavCustomLibrary,
      ): void => {
        if (!library.__releaseId) {
          throw new Error('Cannot copy a library without an ID');
        }

        ga4Emitter({
          type: 'LIBRARY_SELECT',
          payload: {
            action: 'modify_library',
            sketch_id: sketchID || '',
            name: library.name || '',
          },
        });

        const newURL = `${
          Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
        }/${LIBRARIES_MATCH_PATH}`;

        const search = {
          [SOURCE_LIBRARY_ID_PARAM]: library.__releaseId,
          [NAV_PARAM]: SidenavItemId.Libraries,
        };

        const result = getNewWindow(
          `${Config.NEW_WINDOW_ORIGIN}${newURL}`,
          defaultStringifySearch(search),
          '_blank',
        );

        if (!result) {
          throw new Error('Library could not be opened');
        }
      },
      [LibraryMenuHandlersIds.Delete]: (
        library: SidenavStandardLibrary | SidenavCustomLibrary,
      ): void => {
        setDialogInfo({
          id: DialogId.DeleteLibrary,
          data: {
            libraryId: library.id,
            libraryName: library.name,
          },
        });
        setIsOpen(true);
      },
      [LibraryMenuHandlersIds.Download]: async (
        library: SidenavStandardLibrary | SidenavCustomLibrary,
      ): Promise<void> => {
        sendNotification({
          message: formatMessage(messages.libraryDownloadStart, {
            name: `${library.name}-${
              library.__versionForDownload ?? library.__releaseId ?? ''
            }`,
          }),
          mode: NotificationMode.Toast,
          type: NotificationType.Change,
          modeOptions: {
            toastType: ToastType.Passive,
            toastSize: ToastSize.Small,
          },
        });

        if (isCustomLibrary(library)) {
          await downloadCreateLibrary(library.id);
        } else {
          const version = library.__versionForDownload;
          await downloadBuilderLibrary(library.id, version);
        }

        ga4Emitter({
          type: 'LIBRARY_SELECT',
          payload: {
            action: 'download_library',
            sketch_id: sketchID || '',
            name: library.name || '',
          },
        });
      },
    }),
    [
      formatMessage,
      isIotComponent,
      navigate,
      setDialogInfo,
      setIsOpen,
      sketchID,
    ],
  );

  const customErrors = useMemo<Map<ErrorConstructor, MessageDescriptor>>(
    () =>
      new Map([
        [MalformedLibrary as ErrorConstructor, messages.libraryMalformedError],
      ]),
    [],
  );

  const { importLibraryQuery, isLoading: isUploadingLibrary } =
    useImportLibrary();
  const importLibrary = useCallback(
    async (archive: File) => {
      await importLibraryQuery(archive);
    },
    [importLibraryQuery],
  );
  const { wrappedAction: importLibraryHandler } = useActionFailuresHandler<
    void,
    File[]
  >({
    action: importLibrary,
    getKeyFromAction: (file) => `upload-library-${file.name}`,
    successMessage: messages.libraryUploadSuccess,
    alwaysShowSuccessMessage: true,
    customErrors,
  });

  const onLibraryUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (): Promise<void> => {
      if (input.files?.length == 1) {
        const archive = input.files[0];
        await importLibraryHandler(archive);
      }
    };
    input.click();
  }, [importLibraryHandler]);

  useEffect(() => {
    if (!isLibraryRoute) {
      setBypassOrgHeader(false);
    }
  }, [isLibraryRoute]);

  return {
    customLibraryIsLoading: !customLibrary,
    customLibraryFilesAreLoading,
    customLibrary: customLibrary,
    customLibraryFiles: customLibraryFilesContents,
    libraryMenuHandlers,
    onLibraryUpload,
    isUploadingLibrary,
    allContentsRetrieved,
  };
};
