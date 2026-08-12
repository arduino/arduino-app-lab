import { openLinkExternal } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { syntaxHighlighting } from '@codemirror/language';
import {
  Annotation,
  EditorState,
  Extension,
  StateEffect,
  Transaction,
  TransactionSpec,
} from '@codemirror/state';
import { EditorView, scrollPastEnd } from '@codemirror/view';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../i18n/useI18n';
import {
  CodeMirrorEventAnnotation,
  UseCodeEditorParams,
} from './codeMirror.type';
import {
  appendViewInstanceToDom,
  createSplitSyncExtension,
  extMetadata,
  SearchData,
  ViewInstances,
  viewInstances,
  viewInstanceStateMaps,
} from './codeMirrorViewInstances';
import { createErrorHighlightStateField } from './extensions/error-highlight/errorHighlight';
import { createSearchExt } from './extensions/find-and-replace/FindAndReplaceExt';
import { getKeywordsExtensions } from './extensions/keywords/keywords';
import {
  customTags,
  highlightStyle,
} from './extensions/language/highlightStyle';
import {
  FileExt,
  fileExtCodeMirrorExtensionMap,
} from './extensions/language/setup';
import { createLineHighlightStateField } from './extensions/line-highlight/lineHighlight';
import { createLspClient } from './extensions/lsp/lsp-client/lsp-client';
import { LSP_LANGS } from './extensions/lsp/lsp-consts';
import { getLspExtensions } from './extensions/lsp/lsp-extensions/lsp-extensions';
import { toFileUri } from './extensions/lsp/lsp-file-uri';
import { LspLang } from './extensions/lsp/lsp-types';
import {
  codeMirrorAnnotationMap,
  contentToText,
  defaultCodeMirrorAnnotationMap,
  onUpdate,
  REVERTIBLE_INJECT_ID_SUFFIX,
  searchPanelUpdateMetadata,
} from './utils';

type UseCodeMirrorHook = (
  params: UseCodeEditorParams,
) => React.RefObject<HTMLDivElement>;

// The desktop bridge rejects with a bare string, the web one with an Error, and
// a transport fault can produce neither. Only return something we would be
// willing to show a user, so the UI can fall back to generic copy otherwise.
function lspStartErrorMessage(err: unknown): string | undefined {
  const message = typeof err === 'string' ? err : (err as Error)?.message;
  return typeof message === 'string' && message.trim() !== ''
    ? message
    : undefined;
}

// Delay before the Arduino indicator starts reporting index progress. The
// language server answers `initialize` before it starts clangd, so this leaves
// room for a warm-cache index pass to report first and avoids flashing 0%.
const ARDUINO_INDEX_PROGRESS_DELAY_MS = 1000;

// How long to wait for clangd's first index notification before calling the
// language server stalled. Deliberately generous: on a cold cache arduino-cli
// builds the entire compilation database before clangd starts, and on slow
// hardware that is minutes, not seconds. A false alarm here is worse than a late
// one — the failure is already reported the moment the backend knows about it
// (see the lsp-failed event), so this only has to catch a server that is alive
// but never indexes.
const ARDUINO_INDEX_STALL_TIMEOUT_MS = 300_000;

export function createUseCodeMirrorHook(setup: Extension): UseCodeMirrorHook {
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
    onReceiveViewInstance = (): void => undefined,
    highlightLines,
    gutter,
    hasHeader = false,
    readOnly = false,
    useScrollPastEnd = false,
    lspWorkspaceDir,
    isLspEnabled,
    selectFile,
    lspClients,
    filesList,
    startLSP,
    sendLspMessage,
    subscribeLspMessages,
    getLspWorkspaceFile,
    setLspFileValue,
    ensureLspFileValue,
    getActivePane,
    onLspStateChange,
  }: UseCodeEditorParams): React.RefObject<HTMLDivElement> {
    const ref = useRef<HTMLDivElement>(null);
    const { formatMessage } = useI18n();

    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchResultOccurrences, setSearchResultOccurrences] =
      useState<number>(0);

    const searchDependency: SearchData = useMemo(() => {
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

    const startLspExtensions = useCallback(() => {
      const fileExt = getExt?.();
      const fileId = getFileId?.();

      if (!fileExt || !fileId || !lspClients || !lspWorkspaceDir) {
        return null;
      }

      const lang = fileExt as LspLang;
      const lspId = LSP_LANGS[lang];

      const workspaceUri = toFileUri(lspWorkspaceDir);

      if (!lspClients.has(lspId)) {
        onLspStateChange?.(lspId, { type: 'initializing' });

        // Guards the synthetic progress state below against a clangd that never
        // reports. See the .then() that arms it.
        let indexStallTimer: ReturnType<typeof setTimeout> | undefined;
        const clearIndexStall = (): void => {
          if (indexStallTimer !== undefined) {
            clearTimeout(indexStallTimer);
            indexStallTimer = undefined;
          }
        };

        const lspStarted = startLSP?.(lspId, lspWorkspaceDir);
        lspStarted?.catch((err) => {
          clearIndexStall();
          // The backend rejects with a user-facing reason for failures it can
          // diagnose (e.g. a toolchain it cannot execute), so pass it through
          // instead of dropping it into the console only.
          onLspStateChange?.(lspId, {
            type: 'error',
            message: lspStartErrorMessage(err),
          });
          console.error(`LSP start FAILED:`, lspId, err);

          const lspClient = lspClients.get(lspId);
          lspClient?.transportDestroy();
          lspClient?.client.disconnect();
          lspClients.delete(lspId);
        });

        const getActiveView = (): EditorView | null => {
          const activeInstanceId =
            getActivePane?.() === 'B'
              ? ViewInstances.Editor2
              : ViewInstances.Editor;
          return viewInstances[activeInstanceId].instance;
        };

        const { client, transportDestroy } = createLspClient({
          workspaceUri,
          lspId: lspId,
          fileId: fileId,
          selectFile,
          filesList,
          sendLspMessage,
          subscribeLspMessages,
          getLspWorkspaceFile,
          getActiveView,
          setFileValue: setLspFileValue,
          ensureFileValue: ensureLspFileValue,
          lspStarted,
          // Every state the client reports originates in its `$/progress
          // backgroundIndexProgress` handler, so the first one is proof clangd is
          // alive and indexing — which is exactly when the stall guard can go.
          onLspStateChange: (id, state) => {
            clearIndexStall();
            onLspStateChange?.(id, state);
          },
        });

        client.initializing
          .then(() => {
            onLspStateChange?.(lspId, { type: 'ready' });
            if (lspId === 'arduino') {
              setTimeout(() => {
                onLspStateChange?.(lspId, { type: 'progress', progress: 0 });

                // Only clangd's index notifications can move this off 0%, and
                // clangd only starts once arduino-cli has produced a compilation
                // database. When that fails there is nothing to wait for, so
                // without a bound the indicator spun forever — which is how a
                // toolchain that could not run presented to users.
                indexStallTimer = setTimeout(() => {
                  indexStallTimer = undefined;
                  // Teardown (app switch, unmount) disposes every client and
                  // clears this map without going through the error path, so a
                  // client that is no longer registered is gone, not stalled —
                  // reporting it would surface an error for an editor that has
                  // already closed.
                  if (!lspClients.has(lspId)) {
                    return;
                  }
                  onLspStateChange?.(lspId, { type: 'error' });
                }, ARDUINO_INDEX_STALL_TIMEOUT_MS);
              }, ARDUINO_INDEX_PROGRESS_DELAY_MS);
            }
          })
          .catch((err) => {
            clearIndexStall();
            onLspStateChange?.(lspId, {
              type: 'error',
              message: lspStartErrorMessage(err),
            });
            console.error(`LSP start FAILED:`, lspId, err);
          });

        lspClients.set(lspId, { client, transportDestroy });
      }

      const lspExtensions = getLspExtensions({
        client: lspClients.get(lspId)!.client,
        fileId,
        lang,
        workspaceUri,
        formatMessage,
        onHoverLinkClick: openLinkExternal,
        readOnly,
      });

      return lspExtensions;
    }, [
      filesList,
      formatMessage,
      getActivePane,
      getExt,
      getFileId,
      getLspWorkspaceFile,
      lspClients,
      lspWorkspaceDir,
      onLspStateChange,
      readOnly,
      selectFile,
      sendLspMessage,
      subscribeLspMessages,
      startLSP,
    ]);

    const createState = useCallback((): [EditorState, Extension[]] => {
      const extensions = [setup];

      const fileExt = getExt?.();

      if (useScrollPastEnd) {
        extensions.push(scrollPastEnd());
      }

      // LSP extension
      if (isLspEnabled) {
        const isLspLangSupported = LSP_LANGS[fileExt as LspLang];
        if (isLspLangSupported) {
          const lspExtension = startLspExtensions();
          if (lspExtension) {
            extensions.push(lspExtension);
          }
        }
      }

      const compartment = extMetadata[viewInstanceId].readOnly.compartment;
      extMetadata[viewInstanceId].readOnly.dependency = readOnly;
      extensions.push(compartment.of(EditorState.readOnly.of(readOnly)));

      const search = extMetadata[viewInstanceId].search;
      if (search !== undefined) {
        const compartment = search.compartment;
        search.dependency = searchDependency;
        extensions.push(compartment.of(createSearchExt(searchDependency)));
      }

      const matchedExt = Object.values(FileExt).find((fe) => fileExt === fe);
      if (matchedExt) {
        extensions.push(fileExtCodeMirrorExtensionMap[matchedExt]);
        extensions.push(
          syntaxHighlighting(highlightStyle(customTags), { fallback: true }),
        );
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
      if ((!keywordsExt || fileExt === keywordsExt) && keywords) {
        const compartment = extMetadata[viewInstanceId].keywords.compartment;
        extMetadata[viewInstanceId].keywords.dependency = keywords;

        extensions.push(
          compartment.of(getKeywordsExtensions({ keywords, isLspEnabled })),
        );
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

      if (
        viewInstanceId === ViewInstances.Editor ||
        viewInstanceId === ViewInstances.Editor2
      ) {
        extensions.push(createSplitSyncExtension(viewInstanceId));
      }

      const state = EditorState.create({
        doc: getValue?.() || '',
        extensions,
      });

      return [state, extensions];
    }, [
      getExt,
      useScrollPastEnd,
      isLspEnabled,
      readOnly,
      viewInstanceId,
      onChange,
      keywordsExt,
      keywords,
      errorLines,
      highlightLines,
      getValue,
      startLspExtensions,
      searchDependency,
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
    }, [createState, getExt, getFileId, persistState, viewInstanceId]);

    // when `valueInstanceId` or a "custom extension" changes
    useEffect(() => {
      const viewInstance = viewInstances[viewInstanceId].instance;
      if (!viewInstance) return;

      const fileId = getFileId?.();

      const fileIdChanged = viewInstances[viewInstanceId].groupId !== fileId;
      if (fileIdChanged) {
        viewInstances[viewInstanceId].groupId = fileId;
      }

      const instanceId = getValueInstanceId?.();

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
        let event: TransactionSpec = {};

        const gutterExtDependencyRemoved = gutterChanged && !gutter;
        const onChangeExtDependencyRemoved = onChangeChanged && !onChange;

        const ext = getExt?.();
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

              // The rxjs code subject is the source of truth for a file's
              // content. The cached EditorState can fall out of sync when
              // another pane (eg. Editor2 in split view) writes to the same
              // file, because edits made there do not refresh this pane's
              // cache. Drop the stale cache so we rehydrate from the
              // subject via createState() below — otherwise switching back
              // to the file would restore old content and (via the
              // split-sync link effect) clobber the peer pane too.
              //
              // Compare via CodeMirror's `Text.eq()` rather than
              // materialising the full doc with `.toString()`: equality on
              // the Text rope is O(min(len)) in practice and avoids
              // allocating a potentially large string for every value
              // instance change.
              //
              // `contentToText` splits with CodeMirror's own default
              // line-separator pattern: `EditorState.create` treats \r\n as
              // a separator, so the stored doc never contains \r. A plain
              // split('\n') kept the \r on every line of a CRLF file, making
              // this comparison fail unconditionally — the stored state
              // (cursor, scroll) was silently discarded on every tab switch
              // on Windows.
              const subjectDoc = contentToText(getValue?.() || '');
              if (storedState && !storedState.doc.eq(subjectDoc)) {
                viewInstanceStateMaps[viewInstanceId].delete(instanceId);
              } else if (storedState) {
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

            const lineToScroll = getCodeLastInjectionLine?.();

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
          let newValue = getValue?.() || '';

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
                insert: getValue?.() || '',
              },
            };
          }
        }

        const effects: StateEffect<unknown>[] = [];

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
              getKeywordsExtensions({ keywords, isLspEnabled }),
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

        let errorLinesEffect: StateEffect<unknown> | undefined;
        if (errorLinesChanged) {
          extMetadata[viewInstanceId].errorHighlight.dependency = errorLines;
          errorLinesEffect = extMetadata[
            viewInstanceId
          ].errorHighlight.compartment.reconfigure(
            createErrorHighlightStateField(errorLines, viewInstanceId),
          );
        }

        let highlightLinesEffect: StateEffect<unknown> | undefined;
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
      isLspEnabled,
    ]);

    onReceiveViewInstance(viewInstances[viewInstanceId].instance);

    return ref;
  };
}
