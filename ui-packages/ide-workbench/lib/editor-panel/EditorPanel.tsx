import clsx from 'clsx';
import { debounce } from 'lodash-es';
import { memo, ReactElement, useCallback, useEffect, useMemo } from 'react';
import type { Layout } from 'react-resizable-panels';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { CodeEditor, EditorBannerKind } from '../code-editor';
import { KeywordMap } from '../code-mirror';
import {
  linkSplitEditors,
  unlinkSplitEditors,
  ViewInstances,
} from '../code-mirror/codeMirrorViewInstances';
import {
  EditorComponents,
  EditorComponentsProvider,
} from '../editor-components';
import EditorControls from '../editor-controls/EditorControls';
import { EditorStatus, EditorStatusType, StatusProps } from '../editor-status';
import { EditorTabsBar } from '../editor-tabs-bar';
import EditorToolbar from '../editor-toolbar/EditorToolbar';
import { useI18n } from '../i18n/useI18n';
import styles from './editor-panel.module.scss';
import { EditorPanelLogic } from './editorPanel.type';
import EditorSplitDropZone from './EditorSplitDropZone';
import { messages } from './messages';
import {
  defaultContentRenderers,
  PaneContentRenderer,
  resolvePaneContent,
} from './paneContentRenderer';
import SplitEditorPanel from './SplitEditorPanel';

interface EditorPanelProps {
  editorPanelLogic: EditorPanelLogic;
  getKeywords: () => KeywordMap | undefined;
  renderBanner?: (kind: EditorBannerKind) => ReactElement | undefined;
  onCopyCode?: () => void;
  onFileError?: (error: Error) => void;
  /**
   * App-provided pane content renderers, tried in order before the
   * package's own default (image). When none match, the pane renders
   * the CodeEditor. This is the extension seam for file types that only
   * exist in one app: inject a renderer here instead of adding branches
   * to this shared component.
   */
  contentRenderers?: PaneContentRenderer[];
  /**
   * Like `contentRenderers`, but a match replaces the WHOLE editor
   * workspace (split layout, per-pane tabs bars) instead of one pane's
   * content; only the top-level tabs bar stays visible. Used for views
   * that take over the editor surface, e.g. the sketch-secrets editor
   * (see secretsWorkspaceRenderer in ../secrets-editor).
   */
  workspaceRenderers?: PaneContentRenderer[];
  /**
   * The host's own components for the editor's controls (today the tabs
   * bar's split and agent toggles). Anything not given uses the package's
   * copy. Pass a module constant: a new object re-renders every control.
   */
  components?: Partial<EditorComponents>;
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
  const {
    editorPanelLogic,
    classes,
    getKeywords,
    renderBanner,
    onCopyCode,
    onFileError,
    contentRenderers,
    workspaceRenderers,
    components,
  } = props;
  const { formatMessage } = useI18n();
  const {
    codeEditorLogic,
    tabsBarLogic,
    selectedFile,
    isFullscreen,
    codeIsFormatting,
    isConcurrent,
    hideTabs,
    openExternalLink,
    shouldRenderMarkdown,
    setShouldRenderMarkdown,
    markdownCanBeRendered,
    canSwitchMarkdownMode,
    readOnly,
    isSplit = false,
    openOrPushToSplit,
    splitToOtherPanel,
    moveTabToOtherPanel,
    setActiveEditorPanel,
    panelATabsCount,
    splitPanelCodeEditorLogic,
    splitPanelTabsBarLogic,
    splitPanelFileId,
    splitPanelFile,
    splitPanelShouldRenderMarkdown,
    splitPanelSetShouldRenderMarkdown,
    splitPanelCanSwitchMarkdownMode,
    paneExtras,
    storedSplitProportionLeft: rawStoredSplitProportionLeft,
    onSplitResize,
    onToggleAgentPanel,
    agentPanelOpen,
    ...rest
  } = editorPanelLogic();

  // Reject out-of-range persisted values (e.g. a `100` left over from a
  // prior bug that wrote single-panel layouts into the split key).
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
        ? debounce((leftPanelPercent: number) => {
            onSplitResize(leftPanelPercent);
          }, 250)
        : undefined,
    [onSplitResize],
  );
  useEffect(() => () => debouncedSplitResize?.cancel(), [debouncedSplitResize]);
  const handlePanelLayout = useCallback(
    (layout: Layout) => {
      if (!debouncedSplitResize) return;
      // Only persist while both panels exist — when collapsed to single,
      // `split-left` reports 100 and would overwrite the saved split ratio.
      if (!isSplit) return;
      const left = layout['split-left'];
      if (typeof left !== 'number') return;
      debouncedSplitResize(left);
    },
    [debouncedSplitResize, isSplit],
  );

  const handleDropToSplit = useCallback(
    (fileId: string, fromPanel: 'A' | 'B') => {
      moveTabToOtherPanel && moveTabToOtherPanel(fileId, fromPanel);
    },
    [moveTabToOtherPanel],
  );

  const handleSplitToggleClick = useCallback(() => {
    openOrPushToSplit?.();
  }, [openOrPushToSplit]);

  const handleSplitToggleClickFromB = useCallback(() => {
    if (!splitToOtherPanel) return;
    splitToOtherPanel(splitPanelFileId, 'B');
  }, [splitToOtherPanel, splitPanelFileId]);

  const editorsNotification = useMemo(
    (): StatusProps => ({
      type: EditorStatusType.Warning,
      label: formatMessage(messages.concurrentEditingLabel),
      tooltip: formatMessage(messages.concurrentEditingTooltip),
    }),
    [formatMessage],
  );

  // App-provided renderers win over the defaults; first match fills the
  // pane, no match falls back to the CodeEditor.
  const renderers = useMemo(
    () => [...(contentRenderers ?? []), ...defaultContentRenderers],
    [contentRenderers],
  );
  const paneACtx = selectedFile
    ? {
        file: selectedFile,
        paneId: 'A' as const,
        readOnly,
        onCopyCode,
        openExternalLink,
        shouldRenderMarkdown,
        extras: paneExtras?.A,
        classes: { editorImage: classes?.editorImage },
      }
    : null;
  // A workspace renderer match (e.g. the secrets view) replaces the whole
  // split layout; only the top-level tabs bar stays. Image, brick, and
  // markdown files instead use the per-pane tabs bar inside the split
  // layout so each pane stays independently navigable.
  const workspaceContent = paneACtx
    ? resolvePaneContent(workspaceRenderers ?? [], paneACtx)
    : null;
  const paneAContent =
    paneACtx && !workspaceContent
      ? resolvePaneContent(renderers, paneACtx)
      : null;
  const paneBContent = splitPanelFile
    ? resolvePaneContent(renderers, {
        file: splitPanelFile,
        paneId: 'B',
        readOnly,
        onCopyCode,
        openExternalLink,
        shouldRenderMarkdown: splitPanelShouldRenderMarkdown,
        extras: paneExtras?.B,
        classes: { editorImage: classes?.editorImage },
      })
    : null;

  const agentPanelToggle = onToggleAgentPanel
    ? {
        label: formatMessage(messages.agentPanelButton),
        isOpen: agentPanelOpen,
        onToggle: onToggleAgentPanel,
      }
    : undefined;

  // Manage the real-time sync link between the two CodeMirror instances.
  // Link only when both panes show the same file AND both are rendering
  // the CodeEditor (i.e. no content renderer matched). Re-evaluating on
  // render-mode toggles ensures Editor2 is re-linked when it (re)mounts.
  const leftShowsCodeEditor = !paneAContent;
  const rightShowsCodeEditor = !paneBContent;
  useEffect(() => {
    if (!isSplit) {
      unlinkSplitEditors();
      return;
    }
    if (
      selectedFile?.id &&
      selectedFile.id === splitPanelFileId &&
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
    splitPanelFileId,
    leftShowsCodeEditor,
    rightShowsCodeEditor,
  ]);

  const renderContent = (): ReactElement => {
    if (workspaceContent) {
      return workspaceContent;
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
            className={styles['code-panel']}
            minSize={200}
            defaultSize={`${storedSplitProportionLeft ?? 50}%`}
            groupResizeBehavior="preserve-pixel-size"
          >
            <div
              className={styles['code-panel-content']}
              onMouseDownCapture={
                isSplit ? (): void => setActiveEditorPanel?.('A') : undefined
              }
              onFocusCapture={
                isSplit ? (): void => setActiveEditorPanel?.('A') : undefined
              }
            >
              {!hideTabs && (
                <EditorTabsBar
                  tabsBarLogic={tabsBarLogic}
                  panelId="A"
                  classes={{
                    container: classes?.tabsBar,
                    selected: classes?.selectedTab,
                    tab: classes?.tab,
                  }}
                  splitToggle={
                    openOrPushToSplit && !isSplit
                      ? {
                          label: formatMessage(messages.splitViewButton),
                          onToggle: handleSplitToggleClick,
                        }
                      : undefined
                  }
                  agentPanel={isSplit ? undefined : agentPanelToggle}
                />
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
              {paneAContent ?? (
                <CodeEditor
                  classes={{ container: classes?.editorCode }}
                  codeEditorLogic={codeEditorLogic}
                  getKeywords={getKeywords}
                  renderBanner={renderBanner}
                  viewInstanceId={ViewInstances.Editor}
                  onFileError={onFileError}
                />
              )}
            </div>
          </Panel>
          {isSplit && splitPanelCodeEditorLogic && splitPanelTabsBarLogic && (
            <>
              <Separator className={styles['split-separator']} />
              <Panel
                id="split-right"
                className={styles['code-panel']}
                minSize={200}
                defaultSize={`${
                  storedSplitProportionLeft !== undefined
                    ? 100 - storedSplitProportionLeft
                    : 50
                }%`}
                groupResizeBehavior="preserve-pixel-size"
              >
                <SplitEditorPanel
                  codeEditorLogic={splitPanelCodeEditorLogic}
                  tabsBarLogic={splitPanelTabsBarLogic}
                  getKeywords={getKeywords}
                  renderBanner={renderBanner}
                  selectedFile={splitPanelFile}
                  content={paneBContent}
                  onActivate={(): void => setActiveEditorPanel?.('B')}
                  shouldRenderMarkdown={splitPanelShouldRenderMarkdown}
                  setShouldRenderMarkdown={splitPanelSetShouldRenderMarkdown}
                  canSwitchMarkdownMode={splitPanelCanSwitchMarkdownMode}
                  readOnly={readOnly}
                  onFileError={onFileError}
                  onSplitClick={
                    splitToOtherPanel ? handleSplitToggleClickFromB : undefined
                  }
                  agentPanel={agentPanelToggle}
                  classes={{
                    tabsBar: classes?.tabsBar,
                    selectedTab: classes?.selectedTab,
                    tab: classes?.tab,
                    editorCode: classes?.editorCode,
                  }}
                />
              </Panel>
            </>
          )}
        </Group>
        {moveTabToOtherPanel && (
          <EditorSplitDropZone
            isSplit={isSplit}
            panelATabsCount={panelATabsCount ?? 0}
            onMove={handleDropToSplit}
          />
        )}
      </div>
    );
  };

  return (
    <EditorComponentsProvider components={components}>
      <EditorStatus
        className={clsx(styles['editor-panel'], classes?.container)}
        editorStatus={isConcurrent ? editorsNotification : undefined}
      >
        {!hideTabs && !!workspaceContent && (
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
    </EditorComponentsProvider>
  );
};

export default memo(EditorPanel);
