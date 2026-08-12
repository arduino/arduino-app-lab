import {
  CodeReloadCause,
  getAppFileContent,
  getCodeSubjects,
  getUnsavedFilesSubjectNext,
  reloadCodeSubject,
  setCodeSubjects,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { resetModuleScopedState } from '../../../../../../lib/app-components/app-lab/utils';
import { isAbsoluteId, resolveAbsPath } from './filePaths';

export const GET_FILE_CONTENT_QUERY_KEY = 'get-file-content';

type UseFileContentsParams = {
  appPath?: string;
};

type UseFileContentsReturn = {
  fetchFile: (path: string, cause?: CodeReloadCause) => Promise<void>;
  refreshFileContents: (
    filePaths: string[],
    cause?: CodeReloadCause,
  ) => Promise<void>;
};

export function useFileContents({
  appPath,
}: UseFileContentsParams): UseFileContentsReturn {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => resetModuleScopedState();
  }, []);

  const fetchFile = useCallback(
    async (id: string, cause: CodeReloadCause = 'refetch'): Promise<void> => {
      if (!id) return;
      if (!isAbsoluteId(id) && !appPath) return;
      const absPath = resolveAbsPath(id, appPath);

      const content = await queryClient.fetchQuery<string>(
        [GET_FILE_CONTENT_QUERY_KEY, absPath],
        () => getAppFileContent(absPath),
        { staleTime: 0, cacheTime: 0 },
      );

      // Already open → override its buffer in place (new instanceId) so the
      // editor reloads the doc without replacing the subject; otherwise create.
      if (getCodeSubjects().has(id)) {
        reloadCodeSubject(id, content, cause);
      } else {
        setCodeSubjects({ path: id, content });
      }
      getUnsavedFilesSubjectNext(id, false);
    },
    [appPath, queryClient],
  );

  const refreshFileContents = useCallback(
    async (
      ids: string[],
      cause: CodeReloadCause = 'refetch',
    ): Promise<void> => {
      await Promise.all(
        ids.map((id) =>
          getCodeSubjects().has(id) ? fetchFile(id, cause) : undefined,
        ),
      );
    },
    [fetchFile],
  );

  return {
    fetchFile,
    refreshFileContents,
  };
}
