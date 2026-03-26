import { CaretDown as CaretDownIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeRendererProps } from 'react-arborist';

import { XXSmall } from '../typography';
import styles from './file-tree.module.scss';
import { TreeNode } from './fileTree.type';
import { canEditNode } from './utils';

type FileNodeProps = NodeRendererProps<TreeNode> & {
  isEditing: boolean;
  isReadOnly: boolean;
  onEditStart: () => void;
  onEditSubmit: (newName: string) => Promise<void>;
  onEditCancel: () => void;
  onDelete: () => Promise<void>;
  renderNodeIcon: (node: TreeNode) => JSX.Element;
};

const FileNode: React.FC<FileNodeProps> = ({
  node,
  style,
  dragHandle,
  isEditing,
  isReadOnly,
  onEditStart,
  onEditSubmit,
  onEditCancel,
  renderNodeIcon,
}: FileNodeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState<string>(node.data.name);

  const preSubmit = useCallback((): void => {
    const isNewNode = node.data.name === '';
    if (value && (isNewNode || value !== node.data.name)) {
      onEditSubmit(value);
    } else {
      onEditCancel();
    }
  }, [node.data.name, onEditCancel, onEditSubmit, value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timeoutId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing]);

  return (
    <div
      ref={dragHandle}
      style={style}
      className={clsx(styles.node, node.state, styles['tree-node'])}
      onDoubleClick={async (e): Promise<void> => {
        if (isReadOnly || !canEditNode(node.data)) {
          return;
        }
        e.stopPropagation();
        onEditStart();
      }}
    >
      {node.isInternal && (
        <CaretDownIcon
          className={clsx(styles['tree-node-caret'], {
            [styles['tree-node-caret--closed']]: node.isClosed,
          })}
        />
      )}

      <div className={styles['tree-node-icon']}>
        {renderNodeIcon(node.data)}
      </div>

      {!isEditing && (
        <XXSmall className={styles['tree-node-name']}>{node.data.name}</XXSmall>
      )}

      {isEditing && (
        <input
          ref={inputRef}
          className={styles['tree-node-input']}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          value={value}
          onChange={(e): void => setValue(e.target.value)}
          onBlur={(): void => {
            preSubmit();
          }}
          onClick={(e): void => e.stopPropagation()}
          onKeyDown={(e): void => {
            e.stopPropagation();

            if (e.key === 'Enter') {
              preSubmit();
            } else if (e.key === 'Escape') {
              onEditCancel();
            }
          }}
        />
      )}
    </div>
  );
};

export default memo(FileNode);
