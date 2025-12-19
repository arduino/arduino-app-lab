import { unifiedMergeView } from '@codemirror/merge';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { RefCallback, useCallback, useEffect, useRef } from 'react';

export type UseCodeDiffBlockCodeMirror = (
  originalCode: string,
  modifiedCode: string,
  startingLine: number,
) => {
  ref: RefCallback<HTMLDivElement>;
};

export function createUseCodeDiffBlockHook(
  setup: Extension,
): (
  originalCode: string,
  modifiedCode: string,
  startingLine: number,
) => React.RefObject<HTMLDivElement> {
  return function useCodeMirrorCodeDiffBlock(
    originalCode: string,
    modifiedCode: string,
    startingLine: number,
  ) {
    const ref = useRef<HTMLDivElement>(null);
    const viewInstance = useRef<EditorView | null>(null);

    const createState = useCallback((): [EditorState, Extension[]] => {
      const extensions = [
        setup,
        unifiedMergeView({
          original: originalCode,
          highlightChanges: false,
          mergeControls: false,
          gutter: false,
        }),
        lineNumbers({
          formatNumber: (n: number) => String(n + startingLine - 1),
        }),
      ];

      const state = EditorState.create({
        doc: modifiedCode,
        extensions,
      });

      return [state, extensions];
    }, [modifiedCode, originalCode, startingLine]);

    useEffect(() => {
      if (viewInstance.current) {
        return;
      }

      const [state, extensions] = createState();

      viewInstance.current = new EditorView({
        state,
        extensions,
        parent: ref.current || undefined,
      });
    }, [createState]);

    useEffect(() => {
      return () => {
        if (viewInstance.current) {
          viewInstance.current.destroy();
          viewInstance.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (viewInstance.current) {
        const [state] = createState();
        viewInstance.current.setState(state);
      }
    }, [createState]);

    return ref;
  };
}
