// NOTE: At most one EditorPanel may render Editor2 simultaneously.
// The Editor2 slot in `viewInstances` is module-level and shared, so
// mounting a second EditorPanel that also displays Editor2 will clobber
// the first one's reference and break split-sync.
import { setCSSVariable } from '@cloud-editor-mono/common';
import {
  Annotation,
  Compartment,
  EditorState,
  Extension,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect } from 'react';

import styleVars from '../code-editor/code-editor-variables.module.scss';
import { CodeMirrorEventAnnotation } from './codeMirror.type';
import { ErrorHighlightStateEffectValue } from './extensions/error-highlight/errorHighlight';
import { KeywordMap } from './extensions/keywords/keywords.type';
import { LineHighlightStateEffectValue } from './extensions/line-highlight/lineHighlight';
import { CodeEditorOnChangeType } from './utils';

export enum ViewInstances {
  Editor,
  Console,
  Editor2,
}

export const splitSyncAnnotation = Annotation.define<boolean>();

// Defined here (rather than in utils.ts) to avoid a circular import: the
// split-sync extension below needs to skip programmatic file-tab loads
// tagged with this annotation, but utils.ts imports ViewInstances from
// this file.
export const codeMirrorAnnotation =
  Annotation.define<CodeMirrorEventAnnotation>();

// Module-level switch toggled by linkSplitEditors / unlinkSplitEditors.
// The split-sync extension is permanently installed in both Editor and
// Editor2 (see createSplitSyncExtension below); the switch decides at
// fire-time whether to forward each user transaction to the peer view.
let splitSyncEnabled = false;

function getSplitSyncPeer(viewId: ViewInstances): EditorView | null {
  if (viewId === ViewInstances.Editor) {
    return viewInstances[ViewInstances.Editor2].instance;
  }
  if (viewId === ViewInstances.Editor2) {
    return viewInstances[ViewInstances.Editor].instance;
  }
  return null;
}

/**
 * Permanent updateListener installed in Editor and Editor2 at create-time.
 * When split-sync is enabled, mirrors any user-originated docChanged
 * transaction to the peer view, guarding against feedback loops with
 * `splitSyncAnnotation` and against length mismatches that would throw
 * RangeError "Applying change set to a document with the wrong length".
 */
export function createSplitSyncExtension(viewId: ViewInstances): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (!splitSyncEnabled) return;
    if (update.transactions.some((tr) => tr.annotation(splitSyncAnnotation)))
      return;
    // Do not mirror programmatic content swaps (e.g. file-tab loads). Without
    // this guard, switching files in the source pane would dispatch the new
    // file's content to the peer pane and clobber whatever was there.
    if (update.transactions.some((tr) => tr.annotation(codeMirrorAnnotation)))
      return;
    const peer = getSplitSyncPeer(viewId);
    if (!peer) return;
    try {
      if (!peer.state.doc.eq(update.startState.doc)) {
        // Panes diverged — a prior mirror was skipped or failed. Re-seed
        // the peer from the actively-edited document so the views
        // re-converge: without this, both panes keep writing the shared
        // code subject and a save silently persists whichever pane was
        // typed in last, discarding the other's version.
        peer.dispatch({
          changes: {
            from: 0,
            to: peer.state.doc.length,
            insert: update.state.doc.toString(),
          },
          annotations: splitSyncAnnotation.of(true),
        });
      } else {
        peer.dispatch({
          changes: update.changes,
          annotations: splitSyncAnnotation.of(true),
        });
      }
      // Editor1's persisted EditorState (in viewInstanceStateMaps) is only
      // refreshed on creation / file switch, so a write that originated in
      // Editor2 would otherwise leave a stale cached state behind. Drop the
      // cached entry for the affected file id so closing & reopening the
      // tab rehydrates from the up-to-date code subject.
      if (viewId === ViewInstances.Editor2) {
        const editorInstanceId =
          viewInstances[ViewInstances.Editor].valueInstanceId;
        if (editorInstanceId) {
          viewInstanceStateMaps[ViewInstances.Editor].delete(editorInstanceId);
        }
      }
    } catch (err) {
      console.warn('split-sync dispatch failed', err);
    }
  });
}

export function linkSplitEditors(
  source: ViewInstances = ViewInstances.Editor,
): void {
  splitSyncEnabled = true;
  const src = viewInstances[source].instance;
  const peer = getSplitSyncPeer(source);
  if (!src || !peer) return;
  if (peer.state.doc.eq(src.state.doc)) return;
  peer.dispatch({
    changes: {
      from: 0,
      to: peer.state.doc.length,
      insert: src.state.doc.toString(),
    },
    annotations: splitSyncAnnotation.of(true),
  });
}

export function unlinkSplitEditors(): void {
  splitSyncEnabled = false;
}

type ViewInstancesDictionary = {
  [K in ViewInstances]: {
    instance: EditorView | null;
    appendedTo: HTMLElement | null;
    valueInstanceId: string | undefined;
    groupId?: string;
  };
};

type BaseExtMeta<T> = {
  compartment: Compartment;
  dependency: T;
  reset: () => void;
};

type OnChangeExtMeta = BaseExtMeta<CodeEditorOnChangeType | undefined>;
type KeywordsExtMeta = BaseExtMeta<KeywordMap | undefined>;
type ErrorHighlightExtMeta = BaseExtMeta<
  ErrorHighlightStateEffectValue | undefined
>;
type LineHighlightExtMeta = BaseExtMeta<
  LineHighlightStateEffectValue | undefined
>;
type ReadOnlyExtMeta = BaseExtMeta<boolean | undefined>;

export interface GutterData {
  lineNumberStartOffset: number;
}

export interface SearchData {
  isSearching: boolean;
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>;
  searchResultOccurrences: number;
  setSearchResultOccurrences: React.Dispatch<React.SetStateAction<number>>;
  hasHeader: boolean;
}

type GutterExtMeta = BaseExtMeta<GutterData | undefined>;

type SearchExtMeta = BaseExtMeta<SearchData | undefined>;

export type ExtMetaDictionary = {
  [K in ViewInstances]: {
    onChange: OnChangeExtMeta;
    keywords: KeywordsExtMeta;
    errorHighlight: ErrorHighlightExtMeta;
    lineHighlight: LineHighlightExtMeta;
    readOnly: ReadOnlyExtMeta;
    gutter: GutterExtMeta;
    search?: SearchExtMeta;
  };
};

export const viewInstances: ViewInstancesDictionary = {
  [ViewInstances.Editor]: {
    instance: null,
    appendedTo: null,
    valueInstanceId: undefined,
  },
  [ViewInstances.Console]: {
    instance: null,
    appendedTo: null,
    valueInstanceId: undefined,
  },
  [ViewInstances.Editor2]: {
    instance: null,
    appendedTo: null,
    valueInstanceId: undefined,
  },
};

function createExtMetadataObj(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultDependency: undefined | any = undefined,
): BaseExtMeta<undefined> {
  return {
    compartment: new Compartment(),
    dependency: defaultDependency,
    reset(): void {
      this.dependency = defaultDependency;
      this.compartment = new Compartment();
    },
  };
}

function createExtMetadata(): ExtMetaDictionary[ViewInstances] {
  return {
    onChange: createExtMetadataObj(),
    keywords: createExtMetadataObj(),
    errorHighlight: createExtMetadataObj(),
    lineHighlight: createExtMetadataObj(),
    readOnly: createExtMetadataObj(false),
    gutter: createExtMetadataObj(),
  };
}

export const extMetadata: ExtMetaDictionary = {
  [ViewInstances.Editor]: {
    ...createExtMetadata(),
    search: createExtMetadataObj(),
  },
  [ViewInstances.Console]: createExtMetadata(),
  [ViewInstances.Editor2]: {
    ...createExtMetadata(),
    search: createExtMetadataObj(),
  },
};

export const appendViewInstanceToDom = (
  instanceId: ViewInstances,
  node: HTMLElement,
  viewInstanceDom: HTMLElement,
): void => {
  node.append(viewInstanceDom);
  viewInstances[instanceId].appendedTo = node;
};

export const useCodeMirrorInstanceCleanup = (
  viewInstanceId: ViewInstances,
): void => {
  useEffect(() => {
    // Fired on unmount, like skeleton transition or IoT Thing Tab Switch
    return (): void => {
      const viewInstance = viewInstances[viewInstanceId];

      if (viewInstance.instance) {
        viewInstance.instance.dom.parentElement?.removeChild(
          viewInstance.instance.dom,
        );

        if (
          viewInstanceId === ViewInstances.Console ||
          viewInstanceId === ViewInstances.Editor2
        ) {
          // Destroy instance, and assign related "retainer" to avoid leaking
          // detached code mirror elements. Note: we deliberately do NOT
          // toggle splitSyncEnabled here. The split-sync flag is owned by
          // the EditorPanel link/unlink effect, and React 18 StrictMode
          // mount → unmount → remount of Editor2 in dev would otherwise
          // permanently disable sync.
          //
          // Before destroying Editor2, snapshot its current EditorState into
          // the per-file cache so that reselecting the same file later
          // rehydrates the same write-mode state instead of starting fresh.
          // Also clear `valueInstanceId` so the next mount's value-change
          // effect doesn't treat the stale id as the "previous" file and
          // overwrite that file's cached state with the newly-mounted
          // file's content.
          if (viewInstanceId === ViewInstances.Editor2) {
            const previousId = viewInstance.valueInstanceId;
            if (previousId) {
              viewInstanceStateMaps[ViewInstances.Editor2].set(
                previousId,
                viewInstance.instance.state,
              );
            }
            viewInstance.valueInstanceId = undefined;
          }
          viewInstance.instance.destroy();
          viewInstance.instance = null;
        }
      }

      viewInstance.appendedTo = null;

      if (viewInstanceId === ViewInstances.Editor) {
        // ** When user transitions from code editor to the skeleton, reset to default gutter width
        setCSSVariable(
          styleVars.lineNumbersGutterWidth,
          styleVars.defaultLineNumbersGutterWidth,
        );
      }
    };
  }, [viewInstanceId]);
};
export const useCodeMirrorStateCleanup = (
  viewInstanceId: ViewInstances,
  valueInstanceIds: string[],
): void => {
  useEffect(() => {
    const stateMap = viewInstanceStateMaps[viewInstanceId];
    const keys = [...stateMap.keys()];

    const keysToDelete = keys.filter((k) => !valueInstanceIds.includes(k));
    for (const k of keysToDelete) {
      stateMap.delete(k);
    }
  }, [valueInstanceIds, viewInstanceId]);
};

export const viewInstanceStateMaps = {
  [ViewInstances.Editor]: new Map<string, EditorState>(),
  [ViewInstances.Console]: new Map<string, EditorState>(), // for potential console state persistence features
  [ViewInstances.Editor2]: new Map<string, EditorState>(),
};

/**
 * Drops every cached per-file EditorState for the two editor panes. Call
 * on app exit: the cached states hold full document copies and are only
 * pruned while an editor with `useCodeMirrorStateCleanup` is mounted, so
 * without this they outlive the app that produced them.
 */
export function clearEditorStateCaches(): void {
  viewInstanceStateMaps[ViewInstances.Editor].clear();
  viewInstanceStateMaps[ViewInstances.Editor2].clear();
}
