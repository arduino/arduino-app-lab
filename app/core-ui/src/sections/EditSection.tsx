import {
  ConsolePanelLogic,
  EditorPanel,
  EditorPanelLogic,
  ReadOnlyBar,
  ReadOnlyBarLogic,
  secretsWorkspaceRenderer,
  SplitConsole,
  Toolbar,
  ToolbarLogic,
} from '@cloud-editor-mono/ui-components';
import { KeywordMap } from '@cloud-editor-mono/ui-components';
import clsx from 'clsx';
import React, { memo } from 'react';

import styles from './edit-section.module.scss';

const ToolbarMemo = memo(Toolbar);

type EditSectionProps =
  | {
      editorPanelLogic: EditorPanelLogic;
      toolbarLogic: ToolbarLogic;
      consolePanelLogic?: ConsolePanelLogic;
      getKeywords: () => KeywordMap | undefined;
      isCodeOnlyResource?: false | undefined;
    }
  | {
      editorPanelLogic: EditorPanelLogic;
      getKeywords: () => KeywordMap | undefined;
      isCodeOnlyResource: true;
      codeOnlyResType: 'library' | 'readyOnlyMode';
      readOnlyBarLogic?: ReadOnlyBarLogic;
    };

const EditSection: React.FC<EditSectionProps> = (props: EditSectionProps) => {
  const { editorPanelLogic, getKeywords, isCodeOnlyResource } = props;

  if (isCodeOnlyResource) {
    return (
      <>
        {props.readOnlyBarLogic ? (
          <div className={styles['library-editor-panel-header']}>
            <ReadOnlyBar readOnlyBarLogic={props.readOnlyBarLogic} />
          </div>
        ) : null}
        <EditorPanel
          editorPanelLogic={editorPanelLogic}
          getKeywords={getKeywords}
          workspaceRenderers={[secretsWorkspaceRenderer]}
          classes={{
            container: clsx({
              [styles['read-only-editor-panel-container-with-panel']]:
                props.codeOnlyResType === 'readyOnlyMode' &&
                props.readOnlyBarLogic,
              [styles['read-only-editor-panel-container-no-panel']]:
                props.codeOnlyResType === 'readyOnlyMode' &&
                !props.readOnlyBarLogic,
              [styles['library-editor-panel-container']]:
                props.codeOnlyResType === 'library',
            }),
            tabsBar: styles['editor-tabs-bar-indent'],
            tab: styles['editor-tab'],
            selectedTab: styles['editor-selected-tab'],
          }}
        />
      </>
    );
  }

  const { toolbarLogic, consolePanelLogic } = props;

  const editorPanel = (
    <EditorPanel
      editorPanelLogic={editorPanelLogic}
      getKeywords={getKeywords}
      workspaceRenderers={[secretsWorkspaceRenderer]}
      classes={{
        container: styles['editor-panel-container'],
        tabsBar: styles['editor-tabs-bar-indent'],
        tab: styles['editor-tab'],
        selectedTab: styles['editor-selected-tab'],
      }}
    />
  );

  return (
    <div className={styles.container}>
      <ToolbarMemo toolbarLogic={toolbarLogic} />
      {consolePanelLogic ? (
        <SplitConsole consolePanelLogic={consolePanelLogic}>
          {editorPanel}
        </SplitConsole>
      ) : (
        editorPanel
      )}
    </div>
  );
};

export default memo(EditSection);
