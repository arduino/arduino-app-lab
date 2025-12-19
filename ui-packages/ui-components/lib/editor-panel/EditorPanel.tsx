import { memo } from 'react';

import BrickDetail from '../app-lab-brick-detail/BrickDetail';
import MarkdownReader from '../app-lab-markdown-reader/MarkdownReader';
import { CodeEditor } from '../code-editor';
import { KeywordMap } from '../code-mirror';
import EditorControls from '../editor-controls/EditorControls';
import EditorImage from '../editor-image/EditorImage';
import { EditorStatus } from '../editor-status';
import { EditorTabsBar, SUPPORTED_IMAGE_TYPES } from '../editor-tabs-bar';
import EditorToolbar from '../editor-toolbar/EditorToolbar';
import { SecretsEditor } from '../secrets-editor';
import styles from './editor-panel.module.scss';
import { EditorPanelLogic } from './editorPanel.type';
import { editorsNotification } from './EditorPanelSpec';

interface EditorPanelProps {
  editorPanelLogic: EditorPanelLogic;
  getKeywords: () => KeywordMap | undefined;
  readOnlyBanner?: JSX.Element;
  classes?: {
    container: string;
    tabsBar?: string;
    selectedTab?: string;
    tab?: string;
    editorImage?: string;
    editorCode?: string;
  };
}

const EditorPanel: React.FC<EditorPanelProps> = (props: EditorPanelProps) => {
  const { editorPanelLogic, classes, getKeywords, readOnlyBanner } = props;
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
    openExternalLink,
    shouldRenderMarkdown,
    setShouldRenderMarkdown,
    markdownCanBeRendered,
    canSwitchMarkdownMode,
    readOnly,
    ...rest
  } = editorPanelLogic();

  const renderContent = (): JSX.Element => {
    if (selectedFile && selectedFile.ext === 'md' && shouldRenderMarkdown) {
      return (
        <div className={styles['markdown-container']}>
          <MarkdownReader
            key={selectedFile.id}
            content={selectedFile.getData()}
            onOpenExternalLink={openExternalLink}
          />
        </div>
      );
    }

    if (
      selectedFile &&
      SUPPORTED_IMAGE_TYPES.includes(`.${selectedFile.ext}`)
    ) {
      return (
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
      );
    }

    if (selectedFile && selectedFile.ext === 'secrets') {
      return (
        <SecretsEditor secretsEditorLogic={secretsEditorLogic}></SecretsEditor>
      );
    }

    if (selectedFile && selectedFile.ext === 'brick' && brickDetailLogic) {
      return (
        <div className={styles['brick-detail-container']}>
          <BrickDetail
            brickId={selectedFile.id}
            brickDetailLogic={brickDetailLogic}
          />
        </div>
      );
    }

    return (
      <CodeEditor
        classes={{ container: classes?.editorCode }}
        codeEditorLogic={codeEditorLogic}
        getKeywords={getKeywords}
        readOnlyBanner={readOnlyBanner}
      />
    );
  };

  return (
    <EditorStatus
      className={classes?.container}
      editorStatus={isConcurrent ? editorsNotification : undefined}
    >
      {!hideTabs ? (
        <EditorTabsBar
          tabsBarLogic={tabsBarLogic}
          classes={{
            container: classes?.tabsBar,
            selected: classes?.selectedTab,
            tab: classes?.tab,
          }}
        />
      ) : null}
      {selectedFile?.ext === 'md' &&
      markdownCanBeRendered &&
      setShouldRenderMarkdown ? (
        <div
          className={
            shouldRenderMarkdown
              ? styles['toolbar-and-content-rendered']
              : styles['toolbar-and-content-code']
          }
        >
          <EditorToolbar
            type="markdown"
            isRendered={!!shouldRenderMarkdown}
            readOnly={readOnly}
            classes={{
              container: !canSwitchMarkdownMode
                ? styles['editor-md-toolbar-disabled']
                : undefined,
            }}
            onToggleRender={
              canSwitchMarkdownMode ? setShouldRenderMarkdown : () => {}
            }
          />
          {renderContent()}
        </div>
      ) : (
        renderContent()
      )}
      {!rest.hideControls ? (
        <EditorControls
          handlers={rest.editorControlsHandlers}
          isFullscreen={isFullscreen}
          indenting={codeIsFormatting}
        />
      ) : null}
    </EditorStatus>
  );
};

export default memo(EditorPanel);
