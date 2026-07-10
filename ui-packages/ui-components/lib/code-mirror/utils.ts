import { Annotation, EditorSelection, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { SelectedStrings } from '../code-editor/codeEditor.type';
import {
  CodeEditorText,
  CodeMirrorEventAnnotation,
  CodeMirrorEventAnnotationMap,
  CodeMirrorEventAnnotationSideEffects,
  CodeMirrorViewInstanceAnnotationMap,
} from './codeMirror.type';
import {
  codeMirrorAnnotation,
  splitSyncAnnotation,
  ViewInstances,
} from './codeMirrorViewInstances';

// Re-exported for backwards compatibility with existing import paths.
export { codeMirrorAnnotation };

export type CodeEditorOnChangeType = (
  doc: CodeEditorText,
  viewUpdate: ViewUpdate,
) => void;

export function onUpdate(onChange: CodeEditorOnChangeType): Extension {
  return EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
    for (const transaction of viewUpdate.transactions) {
      const annotation = transaction.annotation(codeMirrorAnnotation);

      if (annotation) return codeMirrorEventAnnotationSideEffects[annotation]();

      // Skip updates originating from the split-view peer sync mechanism:
      // the source pane's own onChange already wrote the shared code
      // subject, so running it again here would double-call setCode for
      // every mirrored keystroke. A mirrored dispatch is always its own
      // update cycle on the peer view, so bailing out of the whole
      // listener is safe.
      if (transaction.annotation(splitSyncAnnotation)) return;
    }

    if (viewUpdate.docChanged) {
      const { doc } = viewUpdate.state;
      onChange(doc, viewUpdate);
    }
  });
}

export const codeMirrorAnnotationMap: CodeMirrorEventAnnotationMap = {
  [CodeMirrorEventAnnotation.FileTabLoaded]: codeMirrorAnnotation.of(
    CodeMirrorEventAnnotation.FileTabLoaded,
  ),
  [CodeMirrorEventAnnotation.ContextMenuAction]: codeMirrorAnnotation.of(
    CodeMirrorEventAnnotation.ContextMenuAction,
  ),
  [CodeMirrorEventAnnotation.OutputPanelUpdate]: codeMirrorAnnotation.of(
    CodeMirrorEventAnnotation.OutputPanelUpdate,
  ),
  [CodeMirrorEventAnnotation.SearchPanelUpdate]: codeMirrorAnnotation.of(
    CodeMirrorEventAnnotation.SearchPanelUpdate,
  ),
};

interface SearchPanelUpdateMeta {
  searchResultOccurrences: number;
  isSearching: boolean;
  hasHeader: boolean;
}

export const searchPanelUpdateMetadata =
  Annotation.define<SearchPanelUpdateMeta>();

export const defaultCodeMirrorAnnotationMap: CodeMirrorViewInstanceAnnotationMap =
  {
    [ViewInstances.Editor]:
      codeMirrorAnnotationMap[CodeMirrorEventAnnotation.FileTabLoaded],
    [ViewInstances.Console]:
      codeMirrorAnnotationMap[CodeMirrorEventAnnotation.OutputPanelUpdate],
    [ViewInstances.Editor2]:
      codeMirrorAnnotationMap[CodeMirrorEventAnnotation.FileTabLoaded],
  };

const codeMirrorEventAnnotationSideEffects: CodeMirrorEventAnnotationSideEffects =
  {
    [CodeMirrorEventAnnotation.FileTabLoaded]: (): void => {
      return;
    },
    [CodeMirrorEventAnnotation.ContextMenuAction]: (): void => {
      return;
    },
    [CodeMirrorEventAnnotation.OutputPanelUpdate]: (): void => {
      return;
    },
    [CodeMirrorEventAnnotation.SearchPanelUpdate]: (): void => {
      return;
    },
  };

export function getCurrentSelectedStrings(
  value?: string | null,
  selection?: EditorSelection,
): SelectedStrings[] | undefined {
  const selectedWords = selection?.ranges
    .filter((range) => range.from !== range.to)
    .map((range) => {
      return {
        label: value?.substring(range.from, range.to),
        from: range.from,
        to: range.to,
      };
    });
  return selectedWords;
}

export const FOLD_GUTTER_WIDTH = 10;
export const DEFAULT_LINE_NUMBERS_GUTTER_WIDTH = 30;

// a value injection, with a value instance id containing this suffix will
// be revertible by avoiding state/history wipe in `createUseCodeMirrorHook.ts`
export const REVERTIBLE_INJECT_ID_SUFFIX = '_FROM_ASSIST';
