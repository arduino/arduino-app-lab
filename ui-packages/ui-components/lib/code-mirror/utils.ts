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
import { ViewInstances } from './codeMirrorViewInstances';

export type CodeEditorOnChangeType = (
  doc: CodeEditorText,
  viewUpdate: ViewUpdate,
) => void;

export function onUpdate(onChange: CodeEditorOnChangeType): Extension {
  return EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
    for (const transaction of viewUpdate.transactions) {
      const annotation = transaction.annotation(codeMirrorAnnotation);

      if (annotation) return codeMirrorEventAnnotationSideEffects[annotation]();
    }

    if (viewUpdate.docChanged) {
      const { doc } = viewUpdate.state;
      onChange(doc, viewUpdate);
    }
  });
}

export const codeMirrorAnnotation =
  Annotation.define<CodeMirrorEventAnnotation>();
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
