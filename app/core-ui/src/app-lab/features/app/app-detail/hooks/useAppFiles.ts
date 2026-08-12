import {
  CodeReloadCause,
  getAppFiles,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  FileNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryKey, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { BoardScopedQuery } from '../../../../boardScopedQuery';
import { useFileContents } from './useFileContents';

export const MAIN_SKETCH_PATH = 'sketch/sketch.ino';
export const APP_YAML_PATH = 'app.yaml';
export const SKETCH_YAML_PATH = 'sketch/sketch.yaml';
export const README_PATH = 'README.md';
export const MAIN_PYTHON_PATH = 'python/main.py';

type UseAppFilesParams = {
  appId: string;
  appPath?: string;
};

type UseAppFilesReturn = {
  defaultFile?: FileNode;
  filesList?: FileNode[];
  filesListIsLoading: boolean;
  filesListIsLoaded: boolean;
  fileTree?: TreeNode[];
  filesListKey: QueryKey;
  refetchAppYaml: () => Promise<unknown>;
  refetchSketchYaml: () => Promise<unknown>;
  refetchAppFiles: () => Promise<unknown>;
  fetchFile: (path: string) => Promise<void>;
  refreshFileContents: (
    ids: string[],
    cause?: CodeReloadCause,
  ) => Promise<void>;
};

export function useAppFiles({
  appId,
  appPath,
}: UseAppFilesParams): UseAppFilesReturn {
  const {
    data: { filesList, fileTree } = {},
    isLoading: filesListIsLoading,
    isSuccess: filesListIsLoaded,
    refetch: refetchAppFiles,
  } = useQuery(
    [BoardScopedQuery.APP_FILES, appId],
    async () => {
      if (appPath) {
        return getAppFiles(appPath);
      }
    },
    {
      enabled: !!appPath,
    },
  );

  const defaultFile = useMemo(() => {
    const priorityFiles = [
      README_PATH,
      MAIN_PYTHON_PATH,
      MAIN_SKETCH_PATH,
      APP_YAML_PATH,
    ];

    for (const filePath of priorityFiles) {
      const foundNode = filesList?.find((file) => file.path === filePath);
      if (foundNode) {
        return foundNode;
      }
    }
  }, [filesList]);

  const filesListKey = useMemo<QueryKey>(
    () => [BoardScopedQuery.APP_FILES, appId],
    [appId],
  );

  const { fetchFile, refreshFileContents } = useFileContents({ appPath });

  const refetchAppYaml = useCallback(async (): Promise<void> => {
    await refreshFileContents([APP_YAML_PATH]);
  }, [refreshFileContents]);

  const refetchSketchYaml = useCallback(async (): Promise<void> => {
    await refreshFileContents([SKETCH_YAML_PATH]);
  }, [refreshFileContents]);

  return {
    defaultFile,
    filesList,
    filesListIsLoading,
    filesListIsLoaded,
    fileTree,
    filesListKey,
    refetchAppYaml,
    refetchSketchYaml,
    refetchAppFiles,
    fetchFile,
    refreshFileContents,
  };
}
