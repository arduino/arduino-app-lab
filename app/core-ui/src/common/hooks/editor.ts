import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { EditorView } from '@codemirror/view';
import { useCallback } from 'react';

import { UseFiles } from './files.type';

export const codeEditorViewInstance: { instance: EditorView | null } = {
  instance: null,
};

type UseCodeEditorViewInstance = (
  selectFile: ReturnType<UseFiles>['selectFile'],
  openFiles?: SelectableFileData[],
) => {
  scrollToTop: () => void;
  scrollToLine: (line: number, fileName?: string) => void;
};

export const useCodeEditorViewInstance: UseCodeEditorViewInstance = function (
  selectFile: ReturnType<UseFiles>['selectFile'],
  openFiles?: SelectableFileData[],
): ReturnType<UseCodeEditorViewInstance> {
  const scrollToTop = useCallback((): void => {
    if (codeEditorViewInstance.instance) {
      codeEditorViewInstance.instance.focus();
      codeEditorViewInstance.instance.scrollDOM.scrollTo(0, 0);
    }
  }, []);

  const scrollToLine = useCallback(
    (line: number, fileName?: string): void => {
      if (codeEditorViewInstance.instance) {
        const fileToUpdate = openFiles?.find(
          (f) => f.fileFullName === fileName,
        );
        const editor = codeEditorViewInstance.instance;
        const linePos = editor.state.doc.line(line);
        const position = linePos.from;

        if (fileToUpdate) {
          selectFile(fileToUpdate.fileId);
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

  return {
    scrollToTop,
    scrollToLine,
  };
};
