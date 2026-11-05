import clsx from 'clsx';
import { memo, ReactElement } from 'react';

import { CodeEditor, CodeEditorLogic, EditorBannerKind } from '../code-editor';
import { KeywordMap } from '../code-mirror';
import { ViewInstances } from '../code-mirror/codeMirrorViewInstances';
import { EditorTabsBar, TabsBarLogic } from '../editor-tabs-bar';
import EditorToolbar from '../editor-toolbar/EditorToolbar';
import { useI18n } from '../i18n/useI18n';
import styles from './editor-panel.module.scss';
import { EditorPanelFile } from './editorPanel.type';
import { messages } from './messages';

// A control marked data-keeps-active-editor-panel (the agent panel toggle) acts without making this panel the active one.
const activateUnlessKept = (
  e: React.SyntheticEvent,
  onActivate?: VoidFunction,
): void => {
  if (!(e.target as Element).closest('[data-keeps-active-editor-panel]')) {
    onActivate?.();
  }
};

interface SplitEditorPanelProps {
  codeEditorLogic: CodeEditorLogic;
  tabsBarLogic: TabsBarLogic;
  getKeywords: () => KeywordMap | undefined;
  renderBanner?: (kind: EditorBannerKind) => ReactElement | undefined;
  selectedFile?: EditorPanelFile;
  /**
   * Resolved non-code content for this pane (image, brick, rendered
   * markdown, ...), produced by EditorPanel through its content-renderer
   * list. When null the pane falls back to the CodeEditor.
   */
  content?: ReactElement | null;
  shouldRenderMarkdown?: boolean;
  setShouldRenderMarkdown?: (value: boolean) => void;
  canSwitchMarkdownMode?: boolean;
  readOnly?: boolean;
  onFileError?: (error: Error) => void;
  /**
   * Called when the user clicks the Split CTA inside panel B. Receiver
   * should mirror the current panel-B selection into panel A (Split
   * sub-feature, fromPanel='B').
   */
  onSplitClick?: () => void;
  /**
   * Called when the user interacts with this panel (pointer-down or focus)
   * so the parent can mark panel B as active and route file-tree clicks
   * here.
   */
  onActivate?: () => void;
  /**
   * The host's agent side panel toggle, rendered by the tabs bar next to the
   * split toggle. Arrives from the app: the editor neither owns the panel nor
   * knows what it contains.
   */
  agentPanel?: {
    label: string;
    isOpen?: boolean;
    onToggle: VoidFunction;
  };
  classes?: {
    tabsBar?: string;
    selectedTab?: string;
    tab?: string;
    editorCode?: string;
  };
}

/**
 * Secondary read/write CodeMirror panel for split view, bound to ViewInstances.Editor2.
 * Has its own independent tabs bar and its own write/preview toggle for markdown files.
 * File navigation in this panel does not affect the left panel.
 */
const SplitEditorPanel: React.FC<SplitEditorPanelProps> = ({
  codeEditorLogic,
  tabsBarLogic,
  getKeywords,
  renderBanner,
  selectedFile,
  content,
  shouldRenderMarkdown,
  setShouldRenderMarkdown,
  canSwitchMarkdownMode,
  readOnly,
  onFileError,
  onSplitClick,
  onActivate,
  agentPanel,
  classes,
}: SplitEditorPanelProps) => {
  const { formatMessage } = useI18n();

  return (
    <div
      className={clsx(styles['split-panel'], 'split-panel')}
      onMouseDownCapture={(e): void => activateUnlessKept(e, onActivate)}
      onFocusCapture={(e): void => activateUnlessKept(e, onActivate)}
    >
      <EditorTabsBar
        tabsBarLogic={tabsBarLogic}
        panelId="B"
        classes={{
          container: classes?.tabsBar,
          selected: classes?.selectedTab,
          tab: classes?.tab,
        }}
        splitToggle={
          onSplitClick
            ? {
                label: formatMessage(messages.splitViewButton),
                disabled: true,
                onToggle: onSplitClick,
              }
            : undefined
        }
        agentPanel={agentPanel}
      />
      {selectedFile?.ext === 'md' && (
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
      {content ?? (
        <CodeEditor
          key={selectedFile?.id}
          viewInstanceId={ViewInstances.Editor2}
          codeEditorLogic={codeEditorLogic}
          getKeywords={getKeywords}
          renderBanner={renderBanner}
          classes={{ container: classes?.editorCode }}
          onFileError={onFileError}
        />
      )}
    </div>
  );
};

export default memo(SplitEditorPanel);
