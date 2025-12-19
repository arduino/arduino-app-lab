import {
  ArduinoLoop,
  InfoIconOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { EditorPanel } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { memo } from 'react';

import { useKeywords } from '../../../common/hooks/keywords';
import { useEditorLogic } from './editor.logic';
import styles from './editor.module.scss';
import { EditorLogicParams } from './editor.type';
import { messages } from './messages';

interface EditorFeatProps {
  editorLogicParams: EditorLogicParams;
}

const EditorFeat: React.FC<EditorFeatProps> = (props: EditorFeatProps) => {
  const { editorLogicParams } = props;

  const { editorPanelLogic } = useEditorLogic(editorLogicParams);
  const { openFiles } = editorLogicParams;

  const { formatMessage } = useI18n();

  const getReadOnlyBanner = (): JSX.Element => (
    <div className={styles['editor-read-only-banner']}>
      <InfoIconOutline />
      <span>{formatMessage(messages.readOnlyBanner)}</span>
    </div>
  );
  return openFiles.length > 0 ? (
    <EditorPanel
      editorPanelLogic={editorPanelLogic}
      getKeywords={useKeywords}
      classes={{
        container: styles['editor-panel-container'],
        tabsBar: styles['editor-tabs-bar'],
        selectedTab: styles['editor-selected-tab'],
        tab: styles['editor-tab'],
        editorImage: clsx(styles['editor-image'], styles['editor-readonly']),
        editorCode: clsx(
          styles['editor-code'],
          editorLogicParams.readOnly && styles['editor-readonly'],
        ),
      }}
      readOnlyBanner={getReadOnlyBanner()}
    />
  ) : (
    <div className={styles['editor-empty-state']}>
      <ArduinoLoop />
    </div>
  );
};

export default memo(EditorFeat);
