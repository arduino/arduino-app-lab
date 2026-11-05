import {
  CodeReloadCause,
  statAppPath,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  FileNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { BoardScopedQuery } from '../../../../boardScopedQuery';
import { ListFailure, useAppFileTree } from './useAppFileTree';
import { useFileContents } from './useFileContents';

export const MAIN_SKETCH_PATH = 'sketch/sketch.ino';
export const APP_YAML_PATH = 'app.yaml';
export const SKETCH_YAML_PATH = 'sketch/sketch.yaml';
export const README_PATH = 'README.md';
export const MAIN_PYTHON_PATH = 'python/main.py';

const DEFAULT_FILE_CANDIDATES = [
  README_PATH,
  MAIN_PYTHON_PATH,
  MAIN_SKETCH_PATH,
  APP_YAML_PATH,
];

type UseAppFilesParams = {
  appId: string;
  appPath?: string;
  onListError?: (relDir: string, error: unknown) => void;
};

type UseAppFilesReturn = {
  defaultFilePath?: string | null;
  fileTree?: TreeNode[];
  appDirListed: boolean;
  appDirFailed: boolean;
  listFailure?: ListFailure;
  expandDir: (relDir: string) => void;
  collapseDir: (relDir: string) => void;
  revealPath: (path: string) => void;
  findFileNode: (path: string) => FileNode | undefined;
  invalidateDirs: (paths?: string[]) => void;
  unlistDir: (folder: string) => void;
  relistDir: (folder: string) => void;
  renameDir: (from: string, to: string) => void;
  refetchAppYaml: () => Promise<unknown>;
  refetchSketchYaml: () => Promise<unknown>;
  fetchFile: (path: string) => Promise<void>;
  refreshFileContents: (
    ids: string[],
    cause?: CodeReloadCause,
  ) => Promise<void>;
};

export function useAppFiles({
  appId,
  appPath,
  onListError,
}: UseAppFilesParams): UseAppFilesReturn {
  const {
    fileTree,
    rootFailed: appDirFailed,
    listFailure,
    expandDir,
    collapseDir,
    revealPath,
    findFileNode,
    invalidateDirs,
    unlistDir,
    relistDir,
    renameDir,
  } = useAppFileTree({ appId, appPath, onListError });

  const { data: defaultFilePath } = useQuery({
    queryKey: [BoardScopedQuery.APP_DEFAULT_FILE, appId],
    queryFn: async () => {
      // The root listing already answers for the candidates that live at the
      // root; only the nested ones need a stat, and those go out together.
      const rootFiles = new Set(
        fileTree?.filter((node) => node.type === 'file').map((n) => n.path),
      );
      // A stat that fails rules its candidate out: an error here would leave no default file, and the tabs would never restore.
      const exists = await Promise.all(
        DEFAULT_FILE_CANDIDATES.map(async (candidate) =>
          candidate.includes('/')
            ? statAppPath(`${appPath}/${candidate}`).then(
                (node) => !!node,
                () => false,
              )
            : rootFiles.has(candidate),
        ),
      );
      return DEFAULT_FILE_CANDIDATES.find((_, index) => exists[index]) ?? null;
    },
    enabled: !!appPath && !!fileTree,
  });

  const { fetchFile, refreshFileContents } = useFileContents({ appPath });

  const refetchAppYaml = useCallback(async (): Promise<void> => {
    await refreshFileContents([APP_YAML_PATH]);
  }, [refreshFileContents]);

  const refetchSketchYaml = useCallback(async (): Promise<void> => {
    await refreshFileContents([SKETCH_YAML_PATH]);
  }, [refreshFileContents]);

  return {
    defaultFilePath,
    fileTree,
    appDirListed: !!fileTree,
    appDirFailed,
    listFailure,
    expandDir,
    collapseDir,
    revealPath,
    findFileNode,
    invalidateDirs,
    unlistDir,
    relistDir,
    renameDir,
    refetchAppYaml,
    refetchSketchYaml,
    fetchFile,
    refreshFileContents,
  };
}
