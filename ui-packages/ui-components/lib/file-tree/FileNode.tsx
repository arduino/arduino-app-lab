import { CaretDown as CaretDownIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeRendererProps } from 'react-arborist';

import { XXSmall } from '../typography';
import styles from './file-tree.module.scss';
import { TreeNode } from './fileTree.type';

type FileNodeProps = NodeRendererProps<TreeNode> & {
  isEditing: boolean;
  isReadOnly: boolean;
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
  onEditSubmit,
  onEditCancel,
  renderNodeIcon,
}: FileNodeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Timestamp of the last time the input genuinely gained focus. Used to tell
  // apart a deliberate user blur (cancel) from a programmatic blur caused by a
  // tree re-render/scroll stealing focus right after the input mounts.
  const lastFocusedAtRef = useRef<number>(0);

  const [value, setValue] = useState<string>(node.data.name);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const preSubmit = useCallback((): void => {
    if (isSubmitting) {
      return;
    }

    const isNewNode = node.data.name === '';
    if (value && (isNewNode || value !== node.data.name)) {
      setIsSubmitting(true);
      onEditSubmit(value).finally(() => {
        setIsSubmitting(false);
      });
    } else {
      onEditCancel();
    }
  }, [isSubmitting, node.data.name, onEditCancel, onEditSubmit, value]);

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
    >
      {node.isInternal && (
        <CaretDownIcon
          className={clsx(styles['tree-node-caret'], {
            [styles['tree-node-caret--closed']]: node.isClosed,
          })}
        />
      )}

      <div
        className={clsx(styles['tree-node-icon'], {
          [styles['tree-node-icon--file']]: !node.isInternal,
        })}
      >
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
          disabled={isSubmitting}
          onChange={(e): void => {
            if (!isSubmitting) {
              setValue(e.target.value);
            }
          }}
          onBlur={(): void => {
            if (isSubmitting) {
              return;
            }

            const input = inputRef.current;

            // The input was detached from the DOM (e.g. the virtualized tree
            // unmounted/remounted this row on a slow device). This is not a
            // user action, so don't cancel — `isEditing` is still true and the
            // input will re-mount when it scrolls back into view.
            if (!input || !input.isConnected) {
              return;
            }

            // A blur that fires almost immediately after the input gained
            // focus is a programmatic focus theft from a tree re-render/scroll,
            // not a deliberate user blur. Re-assert focus instead of cancelling
            // so the empty new node doesn't instantly disappear.
            if (Date.now() - lastFocusedAtRef.current < 250) {
              input.focus();
              return;
            }

            preSubmit();
          }}
          onClick={(e): void => e.stopPropagation()}
          onFocus={(): void => {
            lastFocusedAtRef.current = Date.now();
          }}
          onKeyDown={(e): void => {
            e.stopPropagation();

            if (e.key === 'Enter' && !isSubmitting) {
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
