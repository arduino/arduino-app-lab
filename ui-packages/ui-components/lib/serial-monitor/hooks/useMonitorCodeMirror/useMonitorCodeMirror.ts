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
import { toggleTimestamps } from './extensions/timestamps';
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
) => {
  rootRef: React.RefObject<HTMLDivElement>;
  searchBtnRef: RefObject<ShowTooltipHandle>;
  lastLineIsVisible: boolean | null;
  timestampsActive: boolean;
  appendContent: (content: string, sentByUser?: boolean) => void;
  resetContent: () => void;
  scrollToBottom: () => void;
  toggleTimestamps: () => void;
  exportFile: () => void;
  toggleSearchPanel: () => void;
};

function useAutoScroll(
  setLastLineIsVisible: (value: boolean) => void,
  view: EditorView | null,
): {
  autoScrollEnabled: React.MutableRefObject<boolean>;
  notifyCodeMirrorIsScrollingToBottom: () => void;
} {
  const autoScrollEnabled = useRef<boolean>(true);
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
      // Up scroll
      if (scrollTop < lastScrollTop.current) {
        autoScrollEnabled.current = false;
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
  }, [setLastLineIsVisible, view]);

  const notifyCodeMirrorIsScrollingToBottom = useCallback(() => {
    codeMirrorIsScrollingToBottom.current = true;
  }, []);

  return {
    autoScrollEnabled,
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
) => {
  const [lastLineIsVisible, setLastLineIsVisible] = useState<boolean | null>(
    null,
  );
  const [timestampsActive, setTimestampsActive] = useState<boolean>(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewInstanceRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (viewInstanceRef.current) {
      return;
    }

    const startState = EditorState.create({
      doc: '',
      extensions: serialMonitorSetup(
        setTimestampsActive,
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

  const { autoScrollEnabled, notifyCodeMirrorIsScrollingToBottom } =
    useAutoScroll(setLastLineIsVisible, viewInstanceRef.current);

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

      if (autoScrollEnabled.current) {
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
    [autoScrollEnabled, notifyCodeMirrorIsScrollingToBottom],
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
    autoScrollEnabled.current = true;

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
  }, [autoScrollEnabled]);

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

  return {
    rootRef,
    searchBtnRef,
    lastLineIsVisible,
    timestampsActive,
    appendContent,
    resetContent,
    scrollToBottom,
    toggleTimestamps: handleToggleTimestamps,
    exportFile,
    toggleSearchPanel: handleToggleSearchPanel,
  };
};
