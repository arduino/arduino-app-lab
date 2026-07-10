import { searchPanelOpen } from '@codemirror/search';
import {
  ChangeSpec,
  EditorState,
  StateEffect,
  TransactionSpec,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { debounce } from 'lodash';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { SerialMonitorStatus } from '../../SerialMonitor.type';
import { LINE_SEPARATOR } from './constants';
import { addResetEffect } from './extensions/reset';
import {
  closeSearchPanel,
  disableSearchKeymapExt,
  enableSearchKeymapExt,
  toggleSearchPanel,
} from './extensions/search';
import { addSentContentEffect } from './extensions/sentContents';
import { addStyledContentEffect } from './extensions/styleContents';
import { areTimestampsActive, toggleTimestamps } from './extensions/timestamps';
import { trackedData } from './extensions/trackData';
import { serialMonitorSetup } from './setup';

export type ShowTooltipHandle = {
  showTooltip: (value: boolean) => void;
};

export type UseMonitorCodeMirror = (
  status: SerialMonitorStatus,
  codeMirrorParams: {
    lineSeparator: string;
    wrapLines: boolean;
  },
  controlledAutoScrollEnabled?: boolean,
  onAutoScrollChanged?: (enabled: boolean) => void,
  controlledTimestampsActive?: boolean,
  onTimestampsChanged?: (enabled: boolean) => void,
) => {
  rootRef: React.RefObject<HTMLDivElement>;
  searchBtnRef: RefObject<ShowTooltipHandle>;
  lastLineIsVisible: boolean | null;
  timestampsActive: boolean;
  isAutoScrollEnabled: boolean;
  toggleAutoScroll: () => void;
  appendContent: (content: string, sentByUser?: boolean) => void;
  resetContent: () => void;
  scrollToBottom: () => void;
  toggleTimestamps: () => void;
  exportFile: () => void;
  toggleSearchPanel: () => void;
  viewInstance: EditorView | null;
};

function useAutoScroll(
  setLastLineIsVisible: (value: boolean) => void,
  view: EditorView | null,
  controlledAutoScrollEnabled?: boolean,
  onAutoScrollChanged?: (enabled: boolean) => void,
): {
  autoScrollEnabledRef: React.MutableRefObject<boolean>;
  isAutoScrollEnabled: boolean;
  setIsAutoScrollEnabled: (enabled: boolean) => void;
  notifyCodeMirrorIsScrollingToBottom: () => void;
} {
  const autoScrollEnabledRef = useRef<boolean>(
    controlledAutoScrollEnabled ?? true,
  );
  const [internalAutoScrollEnabled, setInternalAutoScrollEnabled] =
    useState<boolean>(controlledAutoScrollEnabled ?? true);

  const isAutoScrollEnabled =
    controlledAutoScrollEnabled ?? internalAutoScrollEnabled;

  const setIsAutoScrollEnabled = useCallback(
    (enabled: boolean) => {
      autoScrollEnabledRef.current = enabled;
      setInternalAutoScrollEnabled(enabled);
      if (onAutoScrollChanged) {
        onAutoScrollChanged(enabled);
      }
    },
    [onAutoScrollChanged],
  );

  const lastScrollTop = useRef<number>(0);
  const codeMirrorIsScrollingToBottom = useRef<boolean>(false);

  useEffect(() => {
    if (!view) {
      return;
    }
    //const view = getViewInstance();

    function checkLastLineIsVisible(): void {
      if (!view) return;

      const lastVisibleLineStartPosition = view.lineBlockAtHeight(
        view.dom.getBoundingClientRect().bottom - view.documentTop,
      ).from;
      const doc = view.state.doc;
      const lastVisibleLineNumber = doc.lineAt(
        lastVisibleLineStartPosition,
      ).number;
      const lastLineNumber = doc.lines;
      const lastLineIsVisible = lastVisibleLineNumber === lastLineNumber;
      setLastLineIsVisible(lastLineIsVisible);
    }

    function shouldDisableAutoScroll(): void {
      if (!view) return;

      const scrollTop = view.scrollDOM.scrollTop;

      if (codeMirrorIsScrollingToBottom.current) {
        lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop;
        return;
      }

      const isAtBottom =
        Math.abs(
          view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight - scrollTop,
        ) < 2;

      // Up scroll
      if (scrollTop < lastScrollTop.current && !isAtBottom) {
        setIsAutoScrollEnabled(false);
        checkLastLineIsVisible();
      }
      lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
    }

    const debouncedHandleScroll = debounce(() => {
      // If the user is scrolling, and is not a result of codeMirror scrolling to bottom
      // then we should check if the last line is visible
      if (!codeMirrorIsScrollingToBottom.current) {
        checkLastLineIsVisible();
      }
      // Scroll event is handled, so we can reset the flag
      codeMirrorIsScrollingToBottom.current = false;
    }, 100);

    view.scrollDOM.addEventListener('scroll', shouldDisableAutoScroll);
    view.scrollDOM.addEventListener('scroll', debouncedHandleScroll);
    return (): void => {
      view.scrollDOM.removeEventListener('scroll', shouldDisableAutoScroll);
      view.scrollDOM.removeEventListener('scroll', debouncedHandleScroll);
    };
  }, [setLastLineIsVisible, view, setIsAutoScrollEnabled]);

  const notifyCodeMirrorIsScrollingToBottom = useCallback(() => {
    codeMirrorIsScrollingToBottom.current = true;
  }, []);

  return {
    autoScrollEnabledRef,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    notifyCodeMirrorIsScrollingToBottom,
  };
}

function useSearch(
  status: SerialMonitorStatus,
  view: EditorView | null,
): {
  searchBtnRef: RefObject<ShowTooltipHandle>;
  handleToggleSearchPanel: () => void;
} {
  const searchBtnRef = useRef<ShowTooltipHandle>(null);

  useEffect(() => {
    function showSearchDisabledTooltip(): void {
      searchBtnRef.current?.showTooltip(true);
      setTimeout(() => {
        searchBtnRef.current?.showTooltip(false);
      }, 3000);
    }

    if (!view) return;

    if (status === SerialMonitorStatus.Active) {
      closeSearchPanel(view);
      disableSearchKeymapExt(view, showSearchDisabledTooltip);
    } else {
      enableSearchKeymapExt(view);
    }
  }, [status, view]);

  const handleToggleSearchPanel = useCallback(() => {
    if (!view) return;
    if (!searchPanelOpen(view.state) && status === SerialMonitorStatus.Active)
      return;
    toggleSearchPanel(view);
  }, [status, view]);

  return {
    searchBtnRef,
    handleToggleSearchPanel,
  };
}

export const useMonitorCodeMirror: UseMonitorCodeMirror = (
  status,
  codeMirrorParams,
  controlledAutoScrollEnabled,
  onAutoScrollChanged,
  controlledTimestampsActive,
  onTimestampsChanged,
) => {
  const [lastLineIsVisible, setLastLineIsVisible] = useState<boolean | null>(
    null,
  );
  const [timestampsActive, setTimestampsActive] = useState<boolean>(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<EditorView | null>(null);

  const onTimestampsChangedRef = useRef(onTimestampsChanged);
  useEffect(() => {
    onTimestampsChangedRef.current = onTimestampsChanged;
  }, [onTimestampsChanged]);

  const handleTimestampsInternalChange = useCallback((active: boolean) => {
    setTimestampsActive(active);
    if (onTimestampsChangedRef.current) {
      onTimestampsChangedRef.current(active);
    }
  }, []);

  useEffect(() => {
    if (viewInstanceRef.current) {
      return;
    }

    const startState = EditorState.create({
      doc: '',
      extensions: serialMonitorSetup(
        handleTimestampsInternalChange,
        codeMirrorParams.lineSeparator,
        codeMirrorParams.wrapLines,
      ),
    });

    const view = new EditorView({
      state: startState,
      parent: rootRef.current || undefined,
    });

    viewInstanceRef.current = view;
  }, [codeMirrorParams]);

  useEffect(() => {
    return () => {
      if (viewInstanceRef.current) {
        viewInstanceRef.current.destroy();
        viewInstanceRef.current = null;
      }
    };
  }, []);

  const {
    autoScrollEnabledRef,
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    notifyCodeMirrorIsScrollingToBottom,
  } = useAutoScroll(
    setLastLineIsVisible,
    viewInstanceRef.current,
    controlledAutoScrollEnabled,
    onAutoScrollChanged,
  );

  const { searchBtnRef, handleToggleSearchPanel } = useSearch(
    status,
    viewInstanceRef.current,
  );

  const appendContent = useCallback(
    (
      content: string,
      sentByUser?: boolean,
      className?: string,
      isGlobalStyle?: boolean,
    ) => {
      const view = viewInstanceRef.current;
      if (!view) return;

      const doc = view.state.doc;
      const lastDocPosition = doc.length;

      const changes: ChangeSpec = { from: lastDocPosition, insert: content };
      const tr: TransactionSpec = { changes, effects: [] };

      if (sentByUser) {
        addSentContentEffect(tr, lastDocPosition, content);
      }

      if (className) {
        if (isGlobalStyle) {
          addStyledContentEffect(tr, 0, doc.toString() + content, className);
        } else {
          addStyledContentEffect(tr, lastDocPosition, content, className);
        }
      }

      if (autoScrollEnabledRef.current) {
        const normalizedContent = content.replace(
          new RegExp(LINE_SEPARATOR, 'g'),
          '',
        );
        (tr.effects as StateEffect<unknown>[]).push(
          EditorView.scrollIntoView(
            lastDocPosition + normalizedContent.length,
            {
              y: 'center',
              yMargin: 0,
            },
          ),
        );
        notifyCodeMirrorIsScrollingToBottom();
      }

      view.dispatch(tr);
    },
    [autoScrollEnabledRef, notifyCodeMirrorIsScrollingToBottom],
  );

  const resetContent = useCallback(() => {
    const view = viewInstanceRef.current;
    if (!view) return;

    const tr = {
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: '',
      },
    };
    addResetEffect(tr);
    view.dispatch(tr);
  }, []);

  const scrollToBottom = useCallback(() => {
    setIsAutoScrollEnabled(true);

    const view = viewInstanceRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        EditorView.scrollIntoView(view.state.doc.length, {
          y: 'center',
          yMargin: 0,
        }),
      ],
    });

    setLastLineIsVisible(true);
  }, [setIsAutoScrollEnabled]);

  const prevControlledAutoScroll = useRef<boolean | undefined>(
    controlledAutoScrollEnabled,
  );

  useEffect(() => {
    if (
      controlledAutoScrollEnabled !== undefined &&
      controlledAutoScrollEnabled !== prevControlledAutoScroll.current
    ) {
      const wasEnabled = autoScrollEnabledRef.current;

      if (controlledAutoScrollEnabled) {
        scrollToBottom();
      } else {
        setIsAutoScrollEnabled(false);
        if (wasEnabled) {
          // If explicitly disabled via external control (while it was active),
          // dismiss the 'view new data' banner by pretending we're at the bottom.
          setLastLineIsVisible(true);
        }
      }
    }
    prevControlledAutoScroll.current = controlledAutoScrollEnabled;
  }, [
    controlledAutoScrollEnabled,
    scrollToBottom,
    setIsAutoScrollEnabled,
    autoScrollEnabledRef,
  ]);

  const toggleAutoScroll = useCallback(() => {
    if (isAutoScrollEnabled) {
      setIsAutoScrollEnabled(false);
    } else {
      scrollToBottom();
    }
  }, [isAutoScrollEnabled, setIsAutoScrollEnabled, scrollToBottom]);

  const exportFile = useCallback(() => {
    //const view = getViewInstance();
    const view = viewInstanceRef.current;
    if (!view) return;

    const data = view.state.field(trackedData);
    const csv = [
      'Timestamp,Value,Type',
      ...data.slice(1).map(({ timestamp, content, type }) => {
        const serializedTextValue = JSON.stringify(content);
        return [timestamp, serializedTextValue, type].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'serial_monitor_export.csv');
    a.click();
  }, []);

  const handleToggleTimestamps = useCallback(() => {
    const view = viewInstanceRef.current;
    if (!view) return;

    toggleTimestamps(view);
  }, []);

  useEffect(() => {
    if (controlledTimestampsActive !== undefined) {
      const view = viewInstanceRef.current;
      if (view && areTimestampsActive(view) !== controlledTimestampsActive) {
        toggleTimestamps(view);
      }
    }
  }, [controlledTimestampsActive]);

  return {
    rootRef,
    searchBtnRef,
    lastLineIsVisible,
    timestampsActive,
    isAutoScrollEnabled,
    toggleAutoScroll,
    appendContent,
    resetContent,
    scrollToBottom,
    toggleTimestamps: handleToggleTimestamps,
    exportFile,
    toggleSearchPanel: handleToggleSearchPanel,
    viewInstance: viewInstanceRef.current,
  };
};
