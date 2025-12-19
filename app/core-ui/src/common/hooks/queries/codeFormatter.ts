import {
  FileId,
  prettifyCode,
  SaveCode,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { CodeEditorText } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

export interface FormatCodePayload {
  code: string;
  fileId?: string;
}

export type UseCodeFormatter = (
  saveCode: SaveCode,
  codeSubjectNext: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    doc?: CodeEditorText,
    shouldUpdate?: boolean,
    newHash?: string,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => void,
) => {
  formatCode: (payload: FormatCodePayload) => void;
  cancelFormat: () => void;
  variables?: FormatCodePayload;
  isLoading: boolean;
};

export const useCodeFormatter: UseCodeFormatter = function (
  saveCode: SaveCode,
  codeSubjectNext: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    doc?: CodeEditorText,
    shouldUpdate?: boolean,
    newHash?: string,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => void,
): ReturnType<UseCodeFormatter> {
  const abortController = useRef<AbortController>();

  const {
    mutate: formatCode,
    isLoading,
    reset,
    variables,
  } = useMutation({
    mutationKey: ['prettify'],
    mutationFn: (payload: FormatCodePayload) =>
      prettifyCode({ code: payload.code }, abortController.current),
    onMutate: () => {
      abortController.current = new AbortController();
    },
    onSuccess: async (result, variables) => {
      if (result && result.codeHasChanged && variables.fileId) {
        codeSubjectNext(
          variables.fileId,
          result.formattedCode,
          saveCode,
          undefined,
          true,
        );
        reset();
        // this clears the mutation state and in turn rerenders main
        // and code editor, ensuring the code editor checks, and confirms the need
        // for a value update/override
      }
    },
  });

  const cancelFormat = useCallback(() => {
    abortController.current?.abort();
    reset();
  }, [reset]);

  return {
    formatCode,
    cancelFormat,
    variables,
    isLoading,
  };
};
