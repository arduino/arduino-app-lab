import {
  ConsolePanelLogic,
  EditorPanel,
  EditorPanelLogic,
  ReadOnlyBar,
  ReadOnlyBarLogic,
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
      consolePanelLogic: ConsolePanelLogic;
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
          }}
        />
      </>
    );
  }

  const { toolbarLogic, consolePanelLogic } = props;

  return (
    <div className={styles.container}>
      <ToolbarMemo toolbarLogic={toolbarLogic} />
      <SplitConsole consolePanelLogic={consolePanelLogic}>
        <EditorPanel
          editorPanelLogic={editorPanelLogic}
          getKeywords={getKeywords}
          classes={{ container: styles['editor-panel-container'] }}
        />
      </SplitConsole>
    </div>
  );
};

export default memo(EditSection);
