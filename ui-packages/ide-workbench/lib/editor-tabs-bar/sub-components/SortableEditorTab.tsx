import { useSortable } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { memo } from 'react';

import styles from './editor-tab.module.scss';
import EditorTab, { EditorTabProps } from './EditorTab';

type DraggableEditorTabProps = EditorTabProps & {
  id: string;
  dropIndicator?: 'left' | 'right';
};

const SortableEditorTab = (
  props: DraggableEditorTabProps,
): React.ReactElement => {
  const { id = '', dropIndicator, ...editorTabProps } = props;

  const { attributes, listeners, setNodeRef } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      className={clsx(styles['sortable-tab'], {
        [styles['drop-indicator-left']]: dropIndicator === 'left',
        [styles['drop-indicator-right']]: dropIndicator === 'right',
      })}
      {...attributes}
      {...listeners}
    >
      <EditorTab {...editorTabProps} />
    </li>
  );
};

SortableEditorTab.displayName = 'SortableEditorTab';
export default memo(SortableEditorTab);
