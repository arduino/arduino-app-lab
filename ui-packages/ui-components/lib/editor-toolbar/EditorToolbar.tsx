import clsx from 'clsx';

import styles from './editor-toolbar.module.scss';
import MarkdownEditorToolbar from './editor-toolbars/MarkdownEditorToolbar';

const EditorToolbarType = ['markdown', 'code'] as const;

type EditorToolbarProps = (
  | {
      type: typeof EditorToolbarType[0];
      isRendered: boolean;
      onToggleRender?: (rendered: boolean) => void;
      readOnly?: boolean;
    }
  | {
      type: typeof EditorToolbarType[1];
    }
) & {
  classes?: { container?: string; disabled?: string };
};

const EditorToolbar: React.FC<EditorToolbarProps> = (
  props: EditorToolbarProps,
) => {
  const { classes } = props;

  const renderToolbar = (): JSX.Element => {
    switch (props.type) {
      case 'markdown':
        return (
          <MarkdownEditorToolbar
            isRendered={props.isRendered}
            onToggleRender={props.onToggleRender}
            readOnly={props.readOnly}
          />
        );
      default:
        return <></>;
    }
  };

  return (
    <div
      className={clsx(styles.container, classes?.container, classes?.disabled)}
    >
      {renderToolbar()}
    </div>
  );
};

export default EditorToolbar;
