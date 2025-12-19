import { setCSSVariable } from '@cloud-editor-mono/common';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect } from 'react';

import styleVars from '../code-editor/code-editor-variables.module.scss';
import { ErrorHighlightStateEffectValue } from './extensions/error-highlight/errorHighlight';
import { KeywordMap } from './extensions/keywords/keywords.type';
import { LineHighlightStateEffectValue } from './extensions/line-highlight/lineHighlight';
import { CodeEditorOnChangeType } from './utils';

export enum ViewInstances {
  Editor,
  Console,
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

        if (viewInstanceId === ViewInstances.Console) {
          // Destroy instance, and assign related "retainer" to avoid leaking
          // detached code mirror elements
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
};
