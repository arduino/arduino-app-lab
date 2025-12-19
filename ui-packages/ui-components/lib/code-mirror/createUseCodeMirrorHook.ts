import {
  Annotation,
  EditorState,
  Extension,
  Transaction,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createGutterExtensions } from '../code-editor/setup/codeMirrorSetup';
import {
  CodeMirrorEventAnnotation,
  UseCodeEditorParams,
} from './codeMirror.type';
import {
  appendViewInstanceToDom,
  extMetadata,
  ViewInstances,
  viewInstances,
  viewInstanceStateMaps,
} from './codeMirrorViewInstances';
import { createErrorHighlightStateField } from './extensions/error-highlight/errorHighlight';
import { createSearchExt } from './extensions/find-and-replace/FindAndReplaceExt';
import { getKeywordsPlugins } from './extensions/keywords/keywordsHighlight';
import {
  FileExt,
  fileExtCodeMirrorExtensionMap,
} from './extensions/language/setup';
import { createLineHighlightStateField } from './extensions/line-highlight/lineHighlight';
import {
  codeMirrorAnnotationMap,
  defaultCodeMirrorAnnotationMap,
  onUpdate,
  REVERTIBLE_INJECT_ID_SUFFIX,
  searchPanelUpdateMetadata,
} from './utils';

export function createUseCodeMirrorHook(
  setup: Extension,
): (params: UseCodeEditorParams) => React.RefObject<HTMLDivElement> {
  return function useCodeMirror({
    viewInstanceId,
    getValueInstanceId,
    getExt,
    getValue,
    getCodeLastInjectionLine,
    getFileId,
    onChange,
    errorLines,
    keywords,
    keywordsExt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onReceiveViewInstance = (viewInstance: EditorView | null): void => {},
    highlightLines,
    gutter,
    hasHeader = false,
    readOnly = false,
  }: UseCodeEditorParams): React.RefObject<HTMLDivElement> {
    const ref = useRef<HTMLDivElement>(null);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchResultOccurrences, setSearchResultOccurrences] =
      useState<number>(0);

    const searchDependency = useMemo(() => {
      return {
        isSearching,
        setIsSearching,
        searchResultOccurrences,
        setSearchResultOccurrences,
        hasHeader,
      };
    }, [hasHeader, isSearching, searchResultOccurrences]);

    useEffect(() => {
      viewInstances[viewInstanceId].instance?.dispatch({
        annotations: [
          codeMirrorAnnotationMap[CodeMirrorEventAnnotation.SearchPanelUpdate],
          searchPanelUpdateMetadata.of({
            searchResultOccurrences: searchDependency.searchResultOccurrences,
            isSearching: searchDependency.isSearching,
            hasHeader: searchDependency.hasHeader,
          }),
        ],
      });
    }, [searchDependency, viewInstanceId]);

    const createState = useCallback((): [EditorState, Extension[]] => {
      const extensions = [setup];

      const compartment = extMetadata[viewInstanceId].readOnly.compartment;
      extMetadata[viewInstanceId].readOnly.dependency = readOnly;
      extensions.push(compartment.of(EditorState.readOnly.of(readOnly)));

      const search = extMetadata[viewInstanceId].search;
      if (search !== undefined) {
        const compartment = search.compartment;
        search.dependency = searchDependency;
        extensions.push(compartment.of(createSearchExt(searchDependency)));
      }

      if (gutter) {
        const compartment = extMetadata[viewInstanceId].gutter.compartment;
        extMetadata[viewInstanceId].gutter.dependency = gutter;

        extensions.push(compartment.of(createGutterExtensions(gutter)));
      } else if (extMetadata[viewInstanceId].gutter.dependency) {
        extMetadata[viewInstanceId].gutter.reset();
      }

      const ext = getExt && getExt();

      const matchedExt = Object.values(FileExt).find((fe) => ext === fe);
      if (matchedExt) {
        extensions.push(fileExtCodeMirrorExtensionMap[matchedExt]);
      } else {
        extensions.push(fileExtCodeMirrorExtensionMap[FileExt.Other]);
      }

      if (onChange) {
        const compartment = extMetadata[viewInstanceId].onChange.compartment;
        extMetadata[viewInstanceId].onChange.dependency = onChange;

        // ** For reference
        // invoking `.of` on the Compartment class overwrites
        // it's extension. A dispatched `reconfigure` state effect on
        // the compartment would have the same eventual effect:
        // https://github.com/codemirror/state/blob/main/src/state.ts#L104
        extensions.push(compartment.of(onUpdate(onChange)));
      } else if (extMetadata[viewInstanceId].onChange.dependency) {
        extMetadata[viewInstanceId].onChange.reset();
      }

      // `keywordsExt` signals if the keywords should only be used
      // with a specific extension
      if ((!keywordsExt || ext === keywordsExt) && keywords) {
        const compartment = extMetadata[viewInstanceId].keywords.compartment;
        extMetadata[viewInstanceId].keywords.dependency = keywords;

        extensions.push(compartment.of(getKeywordsPlugins(keywords)));
      } else if (extMetadata[viewInstanceId].keywords.dependency) {
        extMetadata[viewInstanceId].keywords.reset();
      }

      const errorLineCompartment =
        extMetadata[viewInstanceId].errorHighlight.compartment;
      extMetadata[viewInstanceId].errorHighlight.dependency = errorLines;

      extensions.push(
        errorLineCompartment.of(
          createErrorHighlightStateField(errorLines, viewInstanceId),
        ),
      );

      const lineHighlightCompartment =
        extMetadata[viewInstanceId].lineHighlight.compartment;
      extMetadata[viewInstanceId].lineHighlight.dependency = highlightLines;

      extensions.push(
        lineHighlightCompartment.of(
          createLineHighlightStateField(highlightLines),
        ),
      );

      const state = EditorState.create({
        doc: (getValue && getValue()) || '',
        extensions,
      });

      return [state, extensions];
    }, [
      errorLines,
      getExt,
      getValue,
      gutter,
      highlightLines,
      keywords,
      keywordsExt,
      onChange,
      readOnly,
      searchDependency,
      viewInstanceId,
    ]);

    const persistState = useCallback(
      (state: EditorState) => {
        if (getValueInstanceId) {
          const instanceId = getValueInstanceId();

          if (typeof instanceId === 'string')
            viewInstanceStateMaps[viewInstanceId].set(instanceId, state);
        }
      },
      [getValueInstanceId, viewInstanceId],
    );

    // initial instantiation
    useEffect(() => {
      const viewInstance = viewInstances[viewInstanceId];
      if (viewInstance.instance) {
        if (viewInstance.instance.dom.parentNode === null && ref.current) {
          appendViewInstanceToDom(
            viewInstanceId,
            ref.current,
            viewInstance.instance.dom,
          );
        }
        return;
      }

      const [state, extensions] = createState();
      if (viewInstanceId === ViewInstances.Editor) {
        persistState(state);
      }

      viewInstance.instance = new EditorView({
        extensions,
        state,
      });

      if (ref.current) {
        appendViewInstanceToDom(
          viewInstanceId,
          ref.current,
          viewInstance.instance.dom,
        );
      }
    }, [createState, persistState, viewInstanceId]);

    // when `valueInstanceId` or a "custom extension" changes
    useEffect(() => {
      const viewInstance = viewInstances[viewInstanceId].instance;
      if (!viewInstance) return;

      const fileId = getFileId && getFileId();

      const fileIdChanged = viewInstances[viewInstanceId].groupId !== fileId;
      if (fileIdChanged) {
        viewInstances[viewInstanceId].groupId = fileId;
      }

      const instanceId = getValueInstanceId && getValueInstanceId();

      const moduleScopedValueInstanceId =
        viewInstances[viewInstanceId].valueInstanceId;
      const valueInstanceIdChanged =
        instanceId && instanceId !== moduleScopedValueInstanceId;

      const valueAlreadyUpdated =
        valueInstanceIdChanged &&
        moduleScopedValueInstanceId &&
        !instanceId.includes(REVERTIBLE_INJECT_ID_SUFFIX) &&
        moduleScopedValueInstanceId.includes(REVERTIBLE_INJECT_ID_SUFFIX) &&
        moduleScopedValueInstanceId.split(REVERTIBLE_INJECT_ID_SUFFIX)[0] ===
          instanceId;

      const gutterChanged =
        extMetadata[viewInstanceId].gutter.dependency !== gutter;

      const readOnlyOptionChanged =
        extMetadata[viewInstanceId].readOnly.dependency !== readOnly;

      const searchChanged =
        extMetadata[viewInstanceId].search &&
        extMetadata[viewInstanceId].search?.dependency !== searchDependency;

      const keywordsChanged =
        extMetadata[viewInstanceId].keywords.dependency !== keywords;

      const onChangeChanged =
        extMetadata[viewInstanceId].onChange.dependency !== onChange;

      const errorLinesChanged =
        extMetadata[viewInstanceId].errorHighlight.dependency !== errorLines;
      const highlightLinesChanged =
        extMetadata[viewInstanceId].lineHighlight.dependency !== highlightLines;

      const extensionDependenciesChanged =
        gutterChanged ||
        searchChanged ||
        readOnlyOptionChanged ||
        keywordsChanged ||
        onChangeChanged ||
        errorLinesChanged ||
        highlightLinesChanged;

      const stateChangeIsRequired =
        (valueInstanceIdChanged && !valueAlreadyUpdated) ||
        extensionDependenciesChanged;

      if (valueInstanceIdChanged) {
        viewInstances[viewInstanceId].valueInstanceId = instanceId;
      }

      if (stateChangeIsRequired) {
        let event = {};

        const gutterExtDependencyRemoved = gutterChanged && !gutter;
        const onChangeExtDependencyRemoved = onChangeChanged && !onChange;

        const ext = getExt && getExt();
        const keywordsExtToBeRemoved = keywordsChanged
          ? !keywords
          : keywords && keywordsExt && ext !== keywordsExt;

        const extensionDependencyRemoved =
          gutterExtDependencyRemoved ||
          onChangeExtDependencyRemoved ||
          keywordsExtToBeRemoved;
        // if an extension dependency was truthy and becomes undefined
        // we need to reset state without the extension to remove it

        if (valueInstanceIdChanged || extensionDependencyRemoved) {
          const stateToPersistId = moduleScopedValueInstanceId;
          if (
            (viewInstanceId === ViewInstances.Editor && !instanceId) ||
            (instanceId &&
              (!instanceId?.includes(REVERTIBLE_INJECT_ID_SUFFIX) ||
                fileIdChanged))
          ) {
            if (
              valueInstanceIdChanged &&
              stateToPersistId &&
              (viewInstanceStateMaps[viewInstanceId].has(stateToPersistId) ||
                stateToPersistId.includes(REVERTIBLE_INJECT_ID_SUFFIX))
            ) {
              viewInstanceStateMaps[viewInstanceId].set(
                stateToPersistId,
                viewInstance.state,
              );
            }

            if (valueInstanceIdChanged && !extensionDependencyRemoved) {
              const storedState =
                viewInstanceStateMaps[viewInstanceId].get(instanceId);

              if (storedState) {
                viewInstance.setState(storedState);

                viewInstance.dispatch({
                  scrollIntoView: true,
                });

                return;
              }
            }

            const [newState] = createState();
            persistState(newState);

            viewInstance.setState(newState);

            const lineToScroll =
              getCodeLastInjectionLine && getCodeLastInjectionLine();

            if (lineToScroll !== undefined) {
              const linePos = viewInstance.state.doc.line(lineToScroll);
              const position = linePos.from;

              viewInstance.dispatch({
                effects: EditorView.scrollIntoView(position, {
                  y: 'end',
                }),
              });
            }

            // completely reset state instead of
            // using a transaction: https://codemirror.net/docs/guide/
            // Quote: "To completely reset a state—for example to load a new document—
            // it is recommended to create a new state instead of a transaction"

            // when we do `viewInstance.setState` a reconfigure below is redundant
            return;
          }

          // use transactions for "non-Editor" instances
          const editorValue = viewInstance.state.doc.toString();
          let newValue = (getValue && getValue()) || '';

          // CodeMirror appears to leak `cmLine` dom elements
          // when overwriting the entire document length in quick succession
          // for streams like Builder V2 compile and/or Agent Upload.
          // Inserting only what is new rather than overwriting (as below)
          // appears to alleviate the problem, this is a temporary
          // fix that may need raising directly with CodeMirror maintainers.
          // New compile stdout values arriving after stderr will use
          // the else clause, a diff could be done to include that scenario
          if (newValue.startsWith(editorValue)) {
            newValue = newValue.slice(editorValue.length);
            event = {
              changes: {
                from: editorValue.length,
                to: editorValue.length,
                insert: newValue,
              },
            };
          } else {
            event = {
              changes: {
                from: 0,
                to: editorValue.length || 0,
                insert: (getValue && getValue()) || '',
              },
            };
          }
        }

        const effects = [];

        if (gutterChanged) {
          extMetadata[viewInstanceId].gutter.dependency = gutter;
          effects.push(
            extMetadata[viewInstanceId].gutter.compartment.reconfigure(
              gutter ? createGutterExtensions(gutter) : [],
            ),
          );
        }

        if (readOnlyOptionChanged) {
          extMetadata[viewInstanceId].readOnly.dependency = readOnly;
          effects.push(
            extMetadata[viewInstanceId].readOnly.compartment.reconfigure(
              EditorState.readOnly.of(readOnly),
            ),
          );
        }

        const search = extMetadata[viewInstanceId].search;
        if (search && searchChanged) {
          search.dependency = searchDependency;
          effects.push(
            search.compartment.reconfigure(createSearchExt(searchDependency)),
          );
        }

        if (
          (!keywordsExt || ext === keywordsExt) &&
          keywords &&
          keywordsChanged
        ) {
          extMetadata[viewInstanceId].keywords.dependency = keywords;
          effects.push(
            extMetadata[viewInstanceId].keywords.compartment.reconfigure(
              getKeywordsPlugins(keywords),
            ),
          );
        }

        if (onChange && onChangeChanged) {
          extMetadata[viewInstanceId].onChange.dependency = onChange;
          effects.push(
            extMetadata[viewInstanceId].onChange.compartment.reconfigure(
              onUpdate(onChange),
            ),
          );
        }

        let errorLinesEffect;
        if (errorLinesChanged) {
          extMetadata[viewInstanceId].errorHighlight.dependency = errorLines;
          errorLinesEffect = extMetadata[
            viewInstanceId
          ].errorHighlight.compartment.reconfigure(
            createErrorHighlightStateField(errorLines, viewInstanceId),
          );
        }

        let highlightLinesEffect;
        if (highlightLinesChanged) {
          extMetadata[viewInstanceId].lineHighlight.dependency = highlightLines;
          highlightLinesEffect = extMetadata[
            viewInstanceId
          ].lineHighlight.compartment.reconfigure(
            createLineHighlightStateField(highlightLines),
          );
        }

        const annotations: (
          | Annotation<CodeMirrorEventAnnotation>
          | Annotation<boolean>
        )[] = [defaultCodeMirrorAnnotationMap[viewInstanceId]];

        if (
          !instanceId?.includes(REVERTIBLE_INJECT_ID_SUFFIX) ||
          fileIdChanged
        ) {
          annotations.push(Transaction.addToHistory.of(false));
        }

        event = {
          ...event,
          annotations,
          effects,
        };

        viewInstance.dispatch(event);

        // ** Error lines effect is dispatched separately as
        // ** it can depend on the content of `changes.insert`
        // ** in the `dispatch` above
        if (errorLinesEffect) {
          viewInstance.dispatch({
            effects: [errorLinesEffect],
          });
        }

        if (highlightLinesEffect) {
          viewInstance.dispatch({
            effects: [highlightLinesEffect],
          });
        }
      }
    }, [
      createState,
      errorLines,
      getExt,
      getValue,
      getValueInstanceId,
      gutter,
      searchDependency,
      highlightLines,
      keywords,
      keywordsExt,
      onChange,
      persistState,
      readOnly,
      viewInstanceId,
      getCodeLastInjectionLine,
      getFileId,
    ]);

    onReceiveViewInstance(viewInstances[viewInstanceId].instance);

    return ref;
  };
}
