import { SplitView } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { memo } from 'react';

import { CodeEditor } from '../../../code-editor';
import { CodeEditorLogic } from '../../../code-editor';
import { KeywordMap } from '../../../code-mirror';
import { ViewInstances } from '../../../code-mirror/codeMirrorViewInstances';
import EditorImage from '../../../editor-image/EditorImage';
import panelStyles from '../../../editor-panel/editor-panel.module.scss';
import { messages as panelMessages } from '../../../editor-panel/messages';
import { EditorTabsBar, SUPPORTED_IMAGE_TYPES } from '../../../editor-tabs-bar';
import { TabsBarLogic } from '../../../editor-tabs-bar';
import EditorToolbar from '../../../editor-toolbar/EditorToolbar';
import { useI18n } from '../../../i18n/useI18n';
import BrickDetail from '../brick-detail/BrickDetail';
import { BrickDetailLogic } from '../brick-detail';
import { MarkdownReader } from '../markdown-reader';
import styles from './app-lab-editor-panel.module.scss';

interface SplitEditorPaneProps {
  codeEditorLogic: CodeEditorLogic;
  tabsBarLogic: TabsBarLogic;
  getKeywords: () => KeywordMap | undefined;
  readOnlyBanner?: JSX.Element;
  selectedFile?: { id: string; ext: string; getData: () => string | undefined };
  shouldRenderMarkdown?: boolean;
  setShouldRenderMarkdown?: (value: boolean) => void;
  canSwitchMarkdownMode?: boolean;
  brickDetailLogic?: BrickDetailLogic;
  brickSelectedTab?: string;
  onBrickSelectedTabChange?: (value: string) => void;
  openExternalLink?: (url: string) => void;
  onCopyCode?: () => void;
  readOnly?: boolean;
  /**
   * Called when the user clicks the Split CTA inside panel B. Receiver
   * should mirror the current panel-B selection into panel A (Split
   * sub-feature, fromPane='B').
   */
  onSplitClick?: () => void;
  /**
   * Called when the user interacts with this pane (pointer-down or focus)
   * so the parent can mark pane B as active and route file-tree clicks
   * here.
   */
  onActivate?: () => void;
  classes?: {
    tabsBar?: string;
    selectedTab?: string;
    tab?: string;
    editorCode?: string;
    editorImage?: string;
  };
}

/**
 * Secondary read/write CodeMirror pane for split view, bound to ViewInstances.Editor2.
 * Has its own independent tabs bar and its own write/preview toggle for markdown files.
 * File navigation in this pane does not affect the left pane.
 */
const SplitEditorPane: React.FC<SplitEditorPaneProps> = ({
  codeEditorLogic,
  tabsBarLogic,
  getKeywords,
  readOnlyBanner,
  selectedFile,
  shouldRenderMarkdown,
  setShouldRenderMarkdown,
  canSwitchMarkdownMode,
  brickDetailLogic,
  brickSelectedTab,
  onBrickSelectedTabChange,
  openExternalLink,
  onCopyCode,
  readOnly,
  onSplitClick,
  onActivate,
  classes,
}: SplitEditorPaneProps) => {
  const { formatMessage } = useI18n();
  const isImage =
    !!selectedFile && SUPPORTED_IMAGE_TYPES.includes(`.${selectedFile.ext}`);
  const isBrick =
    !!selectedFile && selectedFile.ext === 'brick' && !!brickDetailLogic;
  const isMarkdownRendered =
    selectedFile?.ext === 'md' && !!shouldRenderMarkdown;

  return (
    <div
      className={clsx(styles['split-pane'], 'split-pane')}
      onMouseDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <EditorTabsBar
        tabsBarLogic={tabsBarLogic}
        paneId="B"
        classes={{
          container: classes?.tabsBar,
          selected: classes?.selectedTab,
          tab: classes?.tab,
        }}
      />
      {onSplitClick && (
        <button
          type="button"
          className={clsx(
            panelStyles['split-toggle'],
            panelStyles['split-toggle--disabled'],
          )}
          disabled
          aria-label={formatMessage(panelMessages.splitViewButton)}
          title={formatMessage(panelMessages.splitViewButton)}
        >
          <SplitView />
        </button>
      )}
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
      {isImage && selectedFile ? (
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
      ) : isBrick && selectedFile && brickDetailLogic ? (
        <div className={panelStyles['brick-container']}>
          <BrickDetail
            brickId={selectedFile.id}
            brickDetailLogic={brickDetailLogic}
            selectedTab={brickSelectedTab}
            onSelectedTabChange={onBrickSelectedTabChange}
          />
        </div>
      ) : isMarkdownRendered ? (
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
          key={selectedFile?.id}
          viewInstanceId={ViewInstances.Editor2}
          codeEditorLogic={codeEditorLogic}
          getKeywords={getKeywords}
          readOnlyBanner={readOnlyBanner}
          classes={{ container: classes?.editorCode }}
        />
      )}
    </div>
  );
};

export default memo(SplitEditorPane);
