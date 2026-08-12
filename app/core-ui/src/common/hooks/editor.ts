import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect } from 'react';

import { UseFiles } from './files.type';

export type CodeEditorPane = 'A' | 'B';

export const codeEditorViewInstances: Record<
  CodeEditorPane,
  EditorView | null
> = {
  A: null,
  B: null,
};

type UseCodeEditorViewInstance = (
  selectFile: ReturnType<UseFiles>['selectFile'],
  openFiles?: SelectableFileData[],
  getActivePane?: () => CodeEditorPane,
) => {
  scrollToTop: () => void;
  scrollToLine: (line: number, fileName?: string) => void;
  focusActivePane: () => void;
};

export const useCodeEditorViewInstance: UseCodeEditorViewInstance = function (
  selectFile: ReturnType<UseFiles>['selectFile'],
  openFiles?: SelectableFileData[],
  getActivePane?: () => CodeEditorPane,
): ReturnType<UseCodeEditorViewInstance> {
  const scrollToTop = useCallback((): void => {
    const editor = codeEditorViewInstances.A;
    if (editor) {
      editor.focus();
      editor.scrollDOM.scrollTo(0, 0);
    }
  }, []);

  const scrollToLine = useCallback(
    (line: number, fileName?: string): void => {
      const editor = codeEditorViewInstances.A;
      if (editor) {
        const fileToUpdate = openFiles?.find(
          (f) => f.fileFullName === fileName,
        );
        const linePos = editor.state.doc.line(line);
        const position = linePos.from;

        if (fileToUpdate) {
          selectFile({ fileId: fileToUpdate.fileId });
        }

        editor.dispatch({
          effects: EditorView.scrollIntoView(position, {
            y: 'end',
          }),
        });
      }
    },
    [selectFile, openFiles],
  );

  const focusActivePane = useCallback((): void => {
    const pane = getActivePane?.() ?? 'A';
    codeEditorViewInstances[pane]?.focus();
  }, [getActivePane]);

  useEffect(
    () => (): void => {
      codeEditorViewInstances.A = null;
      codeEditorViewInstances.B = null;
    },
    [],
  );

  return {
    scrollToTop,
    scrollToLine,
    focusActivePane,
  };
};
