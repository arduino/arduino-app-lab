import {
  ArduinoLoop,
  InfoIconOutline,
} from '@cloud-editor-mono/images/assets/icons';
import {
  EditorPanel,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { memo, useCallback } from 'react';

import styles from './app-lab-editor-panel.module.scss';
import { AppLabEditorPanelLogic } from './appLabEditorPanel.type';
import { messages } from './messages';

interface AppLabEditorPanelProps {
  appLabEditorLogic: AppLabEditorPanelLogic;
}

const AppLabEditorPanel: React.FC<AppLabEditorPanelProps> = (
  props: AppLabEditorPanelProps,
) => {
  const { appLabEditorLogic } = props;

  const { openFiles, readOnly, editorPanelLogic, onCopyCode, getKeywords } =
    appLabEditorLogic();

  const { formatMessage } = useI18n();

  const getReadOnlyBanner = useCallback(
    (): JSX.Element => (
      <div className={styles['editor-read-only-banner']}>
        <InfoIconOutline />
        <span>{formatMessage(messages.readOnlyBanner)}</span>
      </div>
    ),
    [formatMessage],
  );

  if (openFiles.length === 0) {
    return (
      <div className={styles['editor-empty-state']}>
        <ArduinoLoop />
      </div>
    );
  }

  return (
    <EditorPanel
      editorPanelLogic={editorPanelLogic}
      getKeywords={getKeywords}
      onCopyCode={onCopyCode}
      classes={{
        tabsBar: styles['editor-tabs-bar'],
        selectedTab: styles['editor-selected-tab'],
        tab: styles['editor-tab'],
        editorImage: clsx(styles['editor-image'], styles['editor-readonly']),
        editorCode: clsx(
          styles['editor-code'],
          readOnly && styles['editor-readonly'],
        ),
      }}
      readOnlyBanner={getReadOnlyBanner()}
    />
  );
};

export default memo(AppLabEditorPanel);
