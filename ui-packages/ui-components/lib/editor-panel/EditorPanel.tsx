import { SplitView } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import debounce from 'lodash/debounce';
import { memo, useCallback, useEffect, useMemo } from 'react';
import type { Layout } from 'react-resizable-panels';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { CodeEditor } from '../code-editor';
import { KeywordMap } from '../code-mirror';
import {
  linkSplitEditors,
  unlinkSplitEditors,
  ViewInstances,
} from '../code-mirror/codeMirrorViewInstances';
import { BrickDetail, MarkdownReader } from '../components-by-app/app-lab';
import SplitEditorPane from '../components-by-app/app-lab/editor-panel/SplitEditorPane';
import EditorControls from '../editor-controls/EditorControls';
import EditorImage from '../editor-image/EditorImage';
import { EditorStatus } from '../editor-status';
import { EditorTabsBar, SUPPORTED_IMAGE_TYPES } from '../editor-tabs-bar';
import EditorToolbar from '../editor-toolbar/EditorToolbar';
import { WrapperTitle } from '../essential/wrapper-title';
import { useI18n } from '../i18n/useI18n';
import { SecretsEditor } from '../secrets-editor';
import styles from './editor-panel.module.scss';
import { EditorPanelLogic } from './editorPanel.type';
import { editorsNotification } from './EditorPanelSpec';
import EditorSplitDropZone from './EditorSplitDropZone';
import { messages } from './messages';

interface EditorPanelProps {
  editorPanelLogic: EditorPanelLogic;
  getKeywords: () => KeywordMap | undefined;
  readOnlyBanner?: JSX.Element;
  onCopyCode?: () => void;
  classes?: {
    container?: string;
    tabsBar?: string;
    selectedTab?: string;
    tab?: string;
    editorImage?: string;
    editorCode?: string;
  };
}

const EditorPanel: React.FC<EditorPanelProps> = (props: EditorPanelProps) => {
  const { editorPanelLogic, classes, getKeywords, readOnlyBanner, onCopyCode } =
    props;
  const { formatMessage } = useI18n();
  const {
    brickDetailLogic,
    codeEditorLogic,
    secretsEditorLogic,
    tabsBarLogic,
    selectedFile,
    isFullscreen,
    codeIsFormatting,
    isConcurrent,
    hideTabs,
    isSnippet,
    openExternalLink,
    shouldRenderMarkdown,
    setShouldRenderMarkdown,
    markdownCanBeRendered,
    canSwitchMarkdownMode,
    readOnly,
    isSplit = false,
    openOrPushToSplit,
    splitToOtherPane,
    moveTabToOtherPane,
    setActivePane,
    paneATabsCount,
    splitPaneCodeEditorLogic,
    splitPaneTabsBarLogic,
    splitPaneFileId,
    splitPaneFile,
    splitPaneShouldRenderMarkdown,
    splitPaneSetShouldRenderMarkdown,
    splitPaneCanSwitchMarkdownMode,
    splitPaneBrickDetailLogic,
    splitPaneBrickSelectedTab,
    splitPaneSetBrickSelectedTab,
    brickSelectedTab,
    setBrickSelectedTab,
    storedSplitProportionLeft: rawStoredSplitProportionLeft,
    onSplitResize,
    ...rest
  } = editorPanelLogic();

  // Reject out-of-range persisted values (e.g. a `100` left over from a
  // prior bug that wrote single-pane layouts into the split key).
  const storedSplitProportionLeft =
    typeof rawStoredSplitProportionLeft === 'number' &&
    rawStoredSplitProportionLeft >= 10 &&
    rawStoredSplitProportionLeft <= 90
      ? rawStoredSplitProportionLeft
      : undefined;

  // Debounce panel-resize callbacks. `react-resizable-panels` fires
  // `onLayout` on every drag frame, so we throttle the persistence write
  // until the user pauses.
  const debouncedSplitResize = useMemo(
    () =>
      onSplitResize
        ? debounce((leftPanePercent: number) => {
            onSplitResize(leftPanePercent);
          }, 250)
        : undefined,
    [onSplitResize],
  );
  useEffect(() => () => debouncedSplitResize?.cancel(), [debouncedSplitResize]);
  const handlePanelLayout = useCallback(
    (layout: Layout) => {
      if (!debouncedSplitResize) return;
      // Only persist while both panes exist — when collapsed to single,
      // `split-left` reports 100 and would overwrite the saved split ratio.
      if (!isSplit) return;
      const left = layout['split-left'];
      if (typeof left !== 'number') return;
      debouncedSplitResize(left);
    },
    [debouncedSplitResize, isSplit],
  );

  const handleDropToSplit = useCallback(
    (fileId: string, fromPane: 'A' | 'B') => {
      moveTabToOtherPane && moveTabToOtherPane(fileId, fromPane);
    },
    [moveTabToOtherPane],
  );

  const handleSplitToggleClick = useCallback(() => {
    openOrPushToSplit && openOrPushToSplit();
  }, [openOrPushToSplit]);

  const handleSplitToggleClickFromB = useCallback(() => {
    if (!splitToOtherPane) return;
    splitToOtherPane(splitPaneFileId, 'B');
  }, [splitToOtherPane, splitPaneFileId]);

  // Top-level tabs bar is only shown for the secrets view. Image, brick,
  // and markdown files use the per-pane tabs bar inside the split layout
  // so each pane stays independently navigable.
  const isNonCodeFile = !!selectedFile && selectedFile.ext === 'secrets';

  // Manage the real-time sync link between the two CodeMirror instances.
  // Link only when both panes show the same file AND both are rendering the
  // CodeEditor (i.e. neither is showing MarkdownReader/EditorImage/
  // BrickDetail). Re-evaluating on render-mode toggles ensures Editor2 is
  // re-linked when it (re)mounts.
  const leftIsImage =
    !!selectedFile && SUPPORTED_IMAGE_TYPES.includes(`.${selectedFile.ext}`);
  const rightIsImage =
    !!splitPaneFile && SUPPORTED_IMAGE_TYPES.includes(`.${splitPaneFile.ext}`);
  const leftIsBrick =
    !!selectedFile && selectedFile.ext === 'brick' && !!brickDetailLogic;
  const rightIsBrick =
    !!splitPaneFile &&
    splitPaneFile.ext === 'brick' &&
    !!splitPaneBrickDetailLogic;
  const leftShowsCodeEditor =
    !leftIsImage &&
    !leftIsBrick &&
    (selectedFile?.ext !== 'md' || !shouldRenderMarkdown);
  const rightShowsCodeEditor =
    !rightIsImage &&
    !rightIsBrick &&
    (splitPaneFile?.ext !== 'md' || !splitPaneShouldRenderMarkdown);
  useEffect(() => {
    if (!isSplit) {
      unlinkSplitEditors();
      return;
    }
    if (
      selectedFile?.id &&
      selectedFile.id === splitPaneFileId &&
      leftShowsCodeEditor &&
      rightShowsCodeEditor
    ) {
      linkSplitEditors(ViewInstances.Editor);
    } else {
      unlinkSplitEditors();
    }
    return () => {
      unlinkSplitEditors();
    };
  }, [
    isSplit,
    selectedFile?.id,
    splitPaneFileId,
    leftShowsCodeEditor,
    rightShowsCodeEditor,
  ]);

  const renderContent = (): JSX.Element => {
    if (selectedFile && selectedFile.ext === 'secrets') {
      return (
        <SecretsEditor secretsEditorLogic={secretsEditorLogic}></SecretsEditor>
      );
    }

    return (
      <div className={styles['split-group-wrapper']}>
        <Group
          // Remount the panel group on two transitions:
          //   1. Hydration arrives (`storedSplitProportionLeft` goes from
          //      `undefined` → number) so the seeded `defaultSize` is
          //      consumed at mount time.
          //   2. The user toggles `isSplit`. `react-resizable-panels`
          //      doesn't redistribute defaults for Panels added into an
          //      already-mounted Group, so a fresh mount is the only way
          //      to give the newly-shown right Panel its 50% (or stored)
          //      width on first open.
          // Stable tokens — not the raw value — so user-driven resizes
          // write back through `onLayoutChanged` without triggering a
          // remount on every drag frame.
          key={`${isSplit ? 'split' : 'single'}-${
            storedSplitProportionLeft !== undefined ? 'hydrated' : 'pending'
          }`}
          orientation="horizontal"
          className={styles['split-group']}
          onLayoutChanged={handlePanelLayout}
        >
          <Panel
            id="split-left"
            minSize={200}
            defaultSize={`${storedSplitProportionLeft ?? 50}%`}
            groupResizeBehavior="preserve-pixel-size"
          >
            <div
              className={styles['code-pane']}
              onMouseDownCapture={
                isSplit ? (): void => setActivePane?.('A') : undefined
              }
              onFocusCapture={
                isSplit ? (): void => setActivePane?.('A') : undefined
              }
            >
              {!hideTabs && (
                <EditorTabsBar
                  tabsBarLogic={tabsBarLogic}
                  paneId="A"
                  classes={{
                    container: classes?.tabsBar,
                    selected: classes?.selectedTab,
                    tab: classes?.tab,
                  }}
                />
              )}
              {openOrPushToSplit && !isSplit && (
                <WrapperTitle
                  title={formatMessage(messages.splitViewButton)}
                  classNames={{ container: styles['split-toggle-wrapper'] }}
                >
                  <button
                    type="button"
                    className={clsx(styles['split-toggle'])}
                    onClick={handleSplitToggleClick}
                    aria-label={formatMessage(messages.splitViewButton)}
                  >
                    <SplitView />
                  </button>
                </WrapperTitle>
              )}
              {selectedFile?.ext === 'md' && markdownCanBeRendered && (
                <EditorToolbar
                  type="markdown"
                  isRendered={!!shouldRenderMarkdown}
                  readOnly={readOnly}
                  classes={{
                    disabled: !canSwitchMarkdownMode
                      ? styles['editor-toolbar-disabled']
                      : undefined,
                  }}
                  onToggleRender={
                    canSwitchMarkdownMode ? setShouldRenderMarkdown : undefined
                  }
                />
              )}
              {leftIsImage && selectedFile ? (
                <EditorImage
                  key={selectedFile.id}
                  data={selectedFile.getData()}
                  classes={{ container: classes?.editorImage }}
                  extension={
                    selectedFile.ext === 'svg'
                      ? `${selectedFile.ext}+xml`
                      : selectedFile.ext
                  }
                />
              ) : leftIsBrick && selectedFile && brickDetailLogic ? (
                <div className={styles['brick-container']}>
                  <BrickDetail
                    brickId={selectedFile.id}
                    brickDetailLogic={brickDetailLogic}
                    selectedTab={brickSelectedTab}
                    onSelectedTabChange={setBrickSelectedTab}
                  />
                </div>
              ) : selectedFile?.ext === 'md' && shouldRenderMarkdown ? (
                <div className={styles['markdown-container']}>
                  <MarkdownReader
                    key={selectedFile.id}
                    content={selectedFile.getData()}
                    onOpenExternalLink={openExternalLink}
                    onCopyCode={onCopyCode}
                  />
                </div>
              ) : (
                <CodeEditor
                  classes={{
                    container: clsx(classes?.editorCode, {
                      [styles['code-editor--snippet']]: isSnippet,
                    }),
                  }}
                  codeEditorLogic={codeEditorLogic}
                  getKeywords={getKeywords}
                  readOnlyBanner={readOnlyBanner}
                  viewInstanceId={ViewInstances.Editor}
                />
              )}
            </div>
          </Panel>
          {isSplit && splitPaneCodeEditorLogic && splitPaneTabsBarLogic && (
            <>
              <Separator className={styles['split-separator']} />
              <Panel
                id="split-right"
                minSize={200}
                defaultSize={`${
                  storedSplitProportionLeft !== undefined
                    ? 100 - storedSplitProportionLeft
                    : 50
                }%`}
                groupResizeBehavior="preserve-pixel-size"
              >
                <SplitEditorPane
                  codeEditorLogic={splitPaneCodeEditorLogic}
                  tabsBarLogic={splitPaneTabsBarLogic}
                  getKeywords={getKeywords}
                  readOnlyBanner={readOnlyBanner}
                  selectedFile={splitPaneFile}
                  onActivate={(): void => setActivePane?.('B')}
                  shouldRenderMarkdown={splitPaneShouldRenderMarkdown}
                  setShouldRenderMarkdown={splitPaneSetShouldRenderMarkdown}
                  canSwitchMarkdownMode={splitPaneCanSwitchMarkdownMode}
                  brickDetailLogic={splitPaneBrickDetailLogic}
                  brickSelectedTab={splitPaneBrickSelectedTab}
                  onBrickSelectedTabChange={splitPaneSetBrickSelectedTab}
                  openExternalLink={openExternalLink}
                  onCopyCode={onCopyCode}
                  readOnly={readOnly}
                  onSplitClick={
                    splitToOtherPane ? handleSplitToggleClickFromB : undefined
                  }
                  classes={{
                    tabsBar: classes?.tabsBar,
                    selectedTab: classes?.selectedTab,
                    tab: classes?.tab,
                    editorCode: classes?.editorCode,
                    editorImage: classes?.editorImage,
                  }}
                />
              </Panel>
            </>
          )}
        </Group>
        {moveTabToOtherPane && (
          <EditorSplitDropZone
            isSplit={isSplit}
            paneATabsCount={paneATabsCount ?? 0}
            onMove={handleDropToSplit}
          />
        )}
      </div>
    );
  };

  return (
    <EditorStatus
      className={clsx(styles['editor-panel'], classes?.container, {
        [styles['editor-panel--snippet']]: isSnippet,
      })}
      editorStatus={isConcurrent ? editorsNotification : undefined}
    >
      {!hideTabs && isNonCodeFile && (
        <EditorTabsBar
          tabsBarLogic={tabsBarLogic}
          classes={{
            container: classes?.tabsBar,
            selected: classes?.selectedTab,
            tab: classes?.tab,
          }}
        />
      )}
      <div className={styles['editor-content']}>
        {renderContent()}
        {!rest.hideControls && (
          <EditorControls
            handlers={rest.editorControlsHandlers}
            isFullscreen={isFullscreen}
            indenting={codeIsFormatting}
          />
        )}
      </div>
    </EditorStatus>
  );
};

export default memo(EditorPanel);
