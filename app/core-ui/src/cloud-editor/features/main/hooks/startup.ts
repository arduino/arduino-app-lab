import { Config } from '@cloud-editor-mono/common';
import {
  DEFAULT_SKETCH_NAME,
  GetSketchesResult,
  GetSketchResult,
  isHiddenFile,
  isPrivateResourceRequestWithOrgIdError,
  removeCodeSubjectBySketchPath,
  RetrieveFilesListResult,
  retrieveSketches,
} from '@cloud-editor-mono/domain';
import { SketchData, USER_CLAIM_ID } from '@cloud-editor-mono/infrastructure';
import { QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useMessage } from '../../../../common/hooks/messages/broadcastChannel';
import { useGetBoardByFqbn } from '../../../../common/hooks/queries/builder';
import {
  BatchFile,
  refreshSketch,
  SketchDataQueryKey,
  updateSketchDataMap,
  useCreateDefaultSketch,
  useCreateSketchFromExisting,
  useRetrieveBatchFileContents,
  useRetrieveFileContents,
  useRetrieveFilesList,
  useRetrieveSketch,
} from '../../../../common/hooks/queries/create';
import { SketchDataBaseQueryKey } from '../../../../common/hooks/queries/create.type';
import { useRetrieveSketches } from '../../../../common/hooks/queries/createShared';
import { AuthContext } from '../../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../../common/providers/component/componentContext';
import { useGetProposedSketchName } from '../../../../common/utils';
import { UseGetSketchStartUpQueries } from '../main.type';
import { getDefaultSketch, getMainInoFile } from '../utils';
import { useNotFound, useRedirectToPreview } from './routing';
import { SketchBroadcastEvent, useSketchParams } from './sketch';

function isSketchLocatable(
  isExampleSketchRoute: boolean,
  isSketchQueried: boolean,
  isLibraryRoute: boolean,
  getSketchIsLoading: boolean,
  queriedSketchData?: GetSketchResult | null,
): boolean {
  return (
    !isExampleSketchRoute &&
    !isLibraryRoute &&
    (!isSketchQueried ||
      (isSketchQueried && !getSketchIsLoading && !queriedSketchData))
  );
}

function shouldCreateSketch(
  retrieveAllSketches: boolean,
  getSketchesIsLoading: boolean,
  defaultSketchData?: GetSketchResult,
): boolean {
  const userHasNoDefaultSketch = !getSketchesIsLoading && !defaultSketchData;
  return retrieveAllSketches && userHasNoDefaultSketch;
}

export const useGetSketchStartUpQueries: UseGetSketchStartUpQueries = function (
  isLibraryRoute: boolean,
  isExampleSketchRoute: boolean,
): ReturnType<UseGetSketchStartUpQueries> {
  const [bypassOrgHeader, setBypassOrgHeader] = useState(false);
  const [forceNotFound, setForceNotFound] = useState(false);

  const profile = useContext(AuthContext);
  const userWasAuthenticated =
    typeof profile.user !== 'undefined' && !profile.userNotTargetAudience;

  let propSketchId = undefined;
  const componentContext = useContext(ComponentContext);
  if (componentContext) {
    propSketchId = componentContext.sketchId;
  }

  const {
    isSketchQueried,
    sketchID,
    createExampleParam,
    createSketchParam,
    sketchIDIsLoading,
    viewMode,
    scope,
  } = useSketchParams();

  const { data: queriedSketchData, isLoading: getSketchIsLoading } =
    useRetrieveSketch(
      userWasAuthenticated &&
        isSketchQueried &&
        !isExampleSketchRoute &&
        !isLibraryRoute,
      sketchID,
    );

  useRedirectToPreview(
    Boolean(
      !viewMode &&
        !createSketchParam &&
        profile.user &&
        queriedSketchData &&
        !queriedSketchData.organizationId &&
        queriedSketchData.userId !== profile.user[USER_CLAIM_ID],
    ),
  );

  const noLocatableSketch = isSketchLocatable(
    isExampleSketchRoute,
    Boolean(isSketchQueried || propSketchId),
    isLibraryRoute,
    getSketchIsLoading,
    queriedSketchData,
  );

  useNotFound(
    userWasAuthenticated &&
      !sketchIDIsLoading &&
      (queriedSketchData === null || noLocatableSketch || forceNotFound),
    'Sketch',
  );

  const { sketchesData, getSketchesIsLoading } = useRetrieveSketches(
    false,
    retrieveSketches,
    sketchID,
    0,
    DEFAULT_SKETCH_NAME,
  );

  const defaultSketchData = useMemo(
    () => getDefaultSketch(sketchesData),
    [sketchesData],
  );

  const { createdSketch: createdDefaultSketchData } = useCreateDefaultSketch(
    userWasAuthenticated &&
      shouldCreateSketch(
        noLocatableSketch,
        getSketchesIsLoading,
        defaultSketchData,
      ),
  ); // TODO clean this up, it's old code for the MVP where we auto-created a "default sketch" if it didn't exist

  useMessage(SketchBroadcastEvent.SKETCH_DELETE, (message): void => {
    const deletedSketchID = message.data as string;
    if (deletedSketchID && sketchID === deletedSketchID) {
      window.location.href = `${Config.CLOUD_HOME_URL}/sketches`;
    }
  });

  const startupSketch: {
    data: GetSketchResult | undefined;
    key: SketchDataQueryKey | undefined;
  } = useMemo(() => {
    {
      if (isLibraryRoute || isExampleSketchRoute) {
        return { data: undefined, key: undefined };
      } else if (queriedSketchData) {
        return {
          data: queriedSketchData,
          key: [SketchDataBaseQueryKey.GET_SKETCH_BY_ID_QUERY_KEY, sketchID],
        };
      } else if (defaultSketchData) {
        return {
          data: defaultSketchData,
          key: [SketchDataBaseQueryKey.GET_SKETCHES_QUERY_KEY, sketchID],
        };
      } else {
        return {
          data: createdDefaultSketchData,
          key: [SketchDataBaseQueryKey.CREATE_DEFAULT_KEY_QUERY_KEY],
        };
      }
    }
  }, [
    createdDefaultSketchData,
    defaultSketchData,
    isExampleSketchRoute,
    isLibraryRoute,
    queriedSketchData,
    sketchID,
  ]);

  useMessage(SketchBroadcastEvent.SKETCH_UPDATE, () => {
    refreshSketch();
    startupSketch.data?.path &&
      removeCodeSubjectBySketchPath(startupSketch.data?.path);
  });

  const { board } = useGetBoardByFqbn(
    Boolean(startupSketch?.data?.fqbn),
    startupSketch?.data?.fqbn,
  );

  const queryClient = useQueryClient();
  const modifySketchData = useCallback(
    (newData: Partial<SketchData>) => {
      if (!startupSketch?.data) return;

      const queryKey = startupSketch.key;
      if (!queryKey) return;

      const updateSketchDataMapKey = queryKey.find((key) =>
        Boolean(key && Object.keys(updateSketchDataMap).includes(key)),
      ) as SketchDataBaseQueryKey; // TODO check if type guard can be used instead

      if (!updateSketchDataMapKey) return;

      if (
        updateSketchDataMapKey === SketchDataBaseQueryKey.GET_SKETCHES_QUERY_KEY
      ) {
        const data = updateSketchDataMap[updateSketchDataMapKey](
          sketchesData as GetSketchesResult,
          startupSketch.data,
          newData,
        );

        queryClient.setQueryData<GetSketchesResult>(queryKey, data);

        return;
      }

      queryClient.setQueryData<GetSketchResult>(
        queryKey,
        updateSketchDataMap[updateSketchDataMapKey](
          startupSketch.data,
          newData,
        ),
      );
    },
    [queryClient, sketchesData, startupSketch?.data, startupSketch?.key],
  );

  const onPrivateResourceRequestError = useCallback(
    (error: unknown): { errorIsManaged: boolean } => {
      if (
        startupSketch.data?.organizationId || // is not a private sketch
        !error
      ) {
        return { errorIsManaged: false };
      }

      if (!viewMode && !createSketchParam) {
        setForceNotFound(true);
        return { errorIsManaged: false };
      }

      if (isPrivateResourceRequestWithOrgIdError(error)) {
        setBypassOrgHeader(true);
        return { errorIsManaged: true };
      }

      if (bypassOrgHeader) {
        setBypassOrgHeader(false);
        return { errorIsManaged: false };
      }

      return { errorIsManaged: false };
    },
    [
      bypassOrgHeader,
      createSketchParam,
      startupSketch.data?.organizationId,
      viewMode,
    ],
  );

  const filesListKey: QueryKey = useMemo(
    () => [
      'get-files-list',
      startupSketch?.data?.path,
      String(bypassOrgHeader),
    ],
    [startupSketch?.data?.path, bypassOrgHeader],
  );
  const { filesList, invalidateFilesList } = useRetrieveFilesList(
    filesListKey,
    userWasAuthenticated && Boolean(startupSketch?.data),
    bypassOrgHeader,
    onPrivateResourceRequestError,
    startupSketch?.data?.path,
  );

  const mainInoFile = useMemo<RetrieveFilesListResult[0] | undefined>(
    () => getMainInoFile<RetrieveFilesListResult[0]>(filesList),
    [filesList],
  );

  const { fileData: mainInoData } = useRetrieveFileContents(
    userWasAuthenticated &&
      Boolean(startupSketch?.data) &&
      Boolean(mainInoFile),
    bypassOrgHeader,
    onPrivateResourceRequestError,
    mainInoFile?.path,
    mainInoFile?.name,
    scope,
  );

  const filterHiddenFiles = useCallback(
    (file: BatchFile): boolean =>
      file.path !== mainInoFile?.path && !isHiddenFile(file),
    [mainInoFile?.path],
  );

  const filteredFiles = useMemo(
    () => filesList?.filter(filterHiddenFiles) ?? undefined,
    [filesList, filterHiddenFiles],
  );

  const {
    filesContents,
    renameSketchFile,
    addSketchFile,
    mainInoIsRenaming,
    fileIsDeleting,
    deleteSketchFile,
    allContentsRetrieved,
  } = useRetrieveBatchFileContents(
    userWasAuthenticated &&
      Boolean(startupSketch?.data) &&
      Boolean(filesList) &&
      (!viewMode || viewMode !== 'snippet'),
    bypassOrgHeader,
    filesListKey,
    onPrivateResourceRequestError,
    mainInoFile?.path,
    filteredFiles,
  );

  const refreshFileList = (): void => {
    queryClient.invalidateQueries(filesListKey);
  };

  const contentIsNotUndefined =
    (typeof mainInoData?.scopedContent !== 'undefined' ||
      typeof mainInoData?.content !== 'undefined') &&
    typeof mainInoData.path !== 'undefined';
  const sketchDataIsLoaded = contentIsNotUndefined;

  const { getProposedSketchName } = useGetProposedSketchName(
    retrieveSketches,
    mainInoData,
  );

  const onSketchCreated = useCallback(
    (sketch: GetSketchResult) => {
      modifySketchData(sketch);
      setBypassOrgHeader(false);
    },
    [modifySketchData],
  );

  const { create: createSketch, isLoading: isCreatingSketch } =
    useCreateSketchFromExisting(onSketchCreated);
  useEffect(() => {
    if (!filteredFiles) return;

    const shouldWaitForAllFileContents =
      filteredFiles.length === 0 ? false : !allContentsRetrieved;

    if (
      !isCreatingSketch &&
      createSketchParam &&
      mainInoData &&
      !shouldWaitForAllFileContents
    ) {
      (async (): Promise<void> => {
        const proposedSketchName = await getProposedSketchName();

        createSketch({
          sketchName: proposedSketchName,
          sketchContent: mainInoData.data,
          files: filesContents ?? [],
        });
      })();
    }
  }, [
    allContentsRetrieved,
    createSketch,
    createSketchParam,
    filesContents,
    filteredFiles,
    getProposedSketchName,
    isCreatingSketch,
    mainInoData,
  ]);

  return {
    sketchData: startupSketch?.data,
    sketchBoardData: board,
    modifySketchData,
    mainInoData,
    files: filesContents,
    sketchDataIsNotLoaded:
      !sketchDataIsLoaded ||
      mainInoIsRenaming ||
      createExampleParam ||
      createSketchParam,
    userWasAuthenticated,
    fileIsDeleting,
    deleteSketchFile,
    renameSketchFile,
    addSketchFile,
    invalidateFilesList,
    isPrivateSketchViewedFromOrg: bypassOrgHeader,
    refreshFileList,
    allContentsRetrieved:
      filteredFiles?.length === 0 || (allContentsRetrieved && !!mainInoData),
  };
};
