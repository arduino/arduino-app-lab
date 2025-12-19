import {
  getAppBricks,
  getAppDetail,
  getAppFiles,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppDetailedInfo,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import {
  FileNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  FileWithContent,
  useRetrieveArduinoAppFileContents,
  useRetrieveBatchArduinoAppFileContents,
} from '../../../common/hooks/queries/arduinoAppFiles';

export const MAIN_SKETCH_PATH = 'sketch/sketch.ino';
export const APP_YAML_PATH = 'app.yaml';
export const README_PATH = 'README.md';
export const MAIN_PYTHON_PATH = 'python/main.py';

type UseAppDetailFiles = (
  appId: string,
  firstSelectedFile?: FileNode,
) => {
  appDetail?: AppDetailedInfo;
  appDetailIsLoading: boolean;
  appBricks?: BrickInstance[];
  appBricksAreLoading: boolean;
  mainFile?: FileWithContent;
  filesList?: FileNode[];
  filesListIsLoading: boolean;
  filesListIsLoaded: boolean;
  filesContents?: FileWithContent[];
  filesContentsAreLoading: boolean;
  allContentsRetrieved: boolean;
  fileTree?: TreeNode[];
  sketchDataIsLoading: boolean;
  addAppFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<void>;
  renameAppFile: (from?: string, to?: string) => Promise<void>;
  deleteAppFile: (path?: string) => Promise<void>;
  refetchAppDetail: () => void;
  refetchAppYaml: () => Promise<unknown>;
  refetchAppBricks: () => Promise<unknown>;
  removeFileFromPending: (path: string) => void;
  createAppFolder: (path: string) => Promise<void>;
};

export const useAppDetailFiles: UseAppDetailFiles = function (
  appId: string,
  firstSelectedFile?: FileNode,
): ReturnType<UseAppDetailFiles> {
  const {
    data: appDetail,
    isLoading: appDetailIsLoading,
    refetch: refetchAppDetail,
  } = useQuery(['app-detail', appId], () => getAppDetail(appId), {
    refetchOnWindowFocus: false,
  });

  const {
    data: appBricks,
    isLoading: appBricksAreLoading,
    refetch: refetchAppBricks,
  } = useQuery(['app-bricks', appId], () => getAppBricks(appId), {
    refetchOnWindowFocus: false,
  });

  const {
    data: { filesList, fileTree } = {},
    isLoading: filesListIsLoading,
    isSuccess: filesListIsLoaded,
  } = useQuery(
    ['app-files', appId],
    async () => {
      if (appDetail?.path) {
        return getAppFiles(appDetail?.path);
      }
    },
    {
      refetchOnWindowFocus: false,
      enabled: !!appDetail?.path,
    },
  );

  const {
    fileData: firstSelectedFileData,
    isLoading: firstSelectedFileDataIsLoading,
    refetch: refetchFirstSelectedFileData,
  } = useRetrieveArduinoAppFileContents(
    !!filesList && !!firstSelectedFile,
    appDetail?.path,
    firstSelectedFile,
  );

  const firstSelectedFileIsSketchIno =
    !!firstSelectedFile && firstSelectedFile.path === MAIN_SKETCH_PATH;
  const sketchIno = filesList?.find((file) => file.path === MAIN_SKETCH_PATH);
  const { fileData: sketchInoFileData } = useRetrieveArduinoAppFileContents(
    !!filesList &&
      !!firstSelectedFileData &&
      !firstSelectedFileIsSketchIno &&
      !!sketchIno,
    appDetail?.path,
    sketchIno,
  );

  const firstSelectedFileIsAppYaml =
    !!firstSelectedFile && firstSelectedFile.path === APP_YAML_PATH;
  const appYaml = filesList?.find((file) => file.path === APP_YAML_PATH);
  const { fileData: appYamlFileData, refetch: refetchAppYamlFileData } =
    useRetrieveArduinoAppFileContents(
      !firstSelectedFileIsAppYaml && !!filesList && !!firstSelectedFileData,
      appDetail?.path,
      appYaml,
    );

  const refetchAppYaml = useMemo(
    () =>
      firstSelectedFileIsAppYaml
        ? refetchFirstSelectedFileData
        : refetchAppYamlFileData,
    [
      firstSelectedFileIsAppYaml,
      refetchFirstSelectedFileData,
      refetchAppYamlFileData,
    ],
  );

  const filteredFiles = useMemo(() => {
    return (
      firstSelectedFileData &&
      appYamlFileData &&
      filesList?.filter(
        (f) =>
          f.path !== APP_YAML_PATH &&
          f.path !== MAIN_SKETCH_PATH &&
          f.path !== firstSelectedFileData.path,
      )
    );
  }, [firstSelectedFileData, appYamlFileData, filesList]);

  const [pendingFileIds, setPendingFileIds] = useState<string[]>(
    filteredFiles?.map((f) => f.path) || [],
  );

  useEffect(() => {
    if (filteredFiles) {
      setPendingFileIds(filteredFiles.map((f) => f.path));
    }
  }, [filteredFiles]);

  const filesListKey = useMemo(() => ['app-files', appId], [appId]);
  const {
    filesContents,
    isLoading: fileBatchIsLoading,
    allContentsRetrieved,
    deleteAppFile,
    renameAppFile,
    addAppFile,
    createAppFolder,
  } = useRetrieveBatchArduinoAppFileContents(
    !!filesList && !!firstSelectedFileData && !!appYamlFileData,
    filesListKey,
    filteredFiles,
    appDetail?.path,
    pendingFileIds,
  );

  const _filesContents = useMemo(() => {
    const files = filesContents || [];
    if (firstSelectedFileData && !firstSelectedFileIsSketchIno) {
      files.push(firstSelectedFileData);
    }

    if (appYamlFileData) {
      files.push(appYamlFileData);
    }

    return files;
  }, [
    appYamlFileData,
    filesContents,
    firstSelectedFileData,
    firstSelectedFileIsSketchIno,
  ]);

  const removeFileFromPending = useCallback((path: string) => {
    setPendingFileIds((prev) => {
      // if id is not in pending list do nothing
      if (!prev.includes(path)) {
        return prev;
      }

      return prev.filter((id) => id !== path);
    });
  }, []);

  const filesContentsAreLoading =
    firstSelectedFileDataIsLoading || fileBatchIsLoading;

  return {
    appDetail,
    appDetailIsLoading,
    appBricks,
    appBricksAreLoading,
    mainFile: firstSelectedFileIsSketchIno
      ? firstSelectedFileData
      : sketchInoFileData,
    filesList: filesList,
    filesListIsLoading,
    filesListIsLoaded,
    filesContents: _filesContents,
    filesContentsAreLoading,
    allContentsRetrieved,
    fileTree,
    sketchDataIsLoading: filesContentsAreLoading || appBricksAreLoading,
    addAppFile,
    renameAppFile,
    deleteAppFile,
    refetchAppDetail,
    refetchAppYaml,
    refetchAppBricks,
    removeFileFromPending,
    createAppFolder,
  };
};
