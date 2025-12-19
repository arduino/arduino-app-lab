import {
  CloseX,
  FullScreenExpand,
  IndentCode,
  Redo,
  Spinner,
  Undo,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { IconButton } from '../essential/icon-button';
import { WrapperTitle } from '../essential/wrapper-title';
import styles from './editor-controls.module.scss';
import { EditorControl, EditorControlsHandlers } from './editorControls.type';

interface EditorControlsProps {
  handlers: EditorControlsHandlers;
  isFullscreen: boolean;
  indenting: boolean;
}

const EditorControls: React.FC<EditorControlsProps> = (
  props: EditorControlsProps,
) => {
  const { handlers, isFullscreen, indenting } = props;

  return (
    <div className={styles['editor-controls-container']}>
      <WrapperTitle title="Undo">
        <IconButton
          label="Undo"
          Icon={Undo}
          onPress={handlers[EditorControl.Undo]}
          classes={{ button: styles['control'] }}
        />
      </WrapperTitle>
      <WrapperTitle title="Redo">
        <IconButton
          label="Redo"
          Icon={Redo}
          onPress={handlers[EditorControl.Redo]}
          classes={{ button: styles['control'] }}
        />
      </WrapperTitle>
      {handlers[EditorControl.Fullscreen] ? (
        <WrapperTitle title="Fullscreen">
          <IconButton
            label="Fullscreen"
            Icon={isFullscreen ? CloseX : FullScreenExpand}
            onPress={handlers[EditorControl.Fullscreen]}
            classes={{ button: styles['control'] }}
          />
        </WrapperTitle>
      ) : null}
      <WrapperTitle title="Indent">
        <IconButton
          label="Indent"
          Icon={indenting ? Spinner : IndentCode}
          onPress={handlers[EditorControl.Indent]}
          classes={{
            button: clsx(styles['control'], { [styles.spinner]: indenting }),
          }}
        />
      </WrapperTitle>
    </div>
  );
};

export default EditorControls;
