import { CaretDown as CaretDownIcon } from '@cloud-editor-mono/images/assets/icons';
import { isValidResourceName } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeRendererProps } from 'react-arborist';

import { useI18n } from '../i18n/useI18n';
import { XXSmall } from '../typography';
import styles from './file-tree.module.scss';
import { TreeNode } from './fileTree.type';
import { messages } from './messages';

type FileNodeProps = NodeRendererProps<TreeNode> & {
  isEditing: boolean;
  isReadOnly: boolean;
  onEditSubmit: (newName: string) => Promise<void>;
  onEditCancel: () => void;
  onValidationError?: () => void;
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
  onValidationError,
  renderNodeIcon,
}: FileNodeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Timestamp of the last time the input genuinely gained focus. Used to tell
  // apart a deliberate user blur (cancel) from a programmatic blur caused by a
  // tree re-render/scroll stealing focus right after the input mounts.
  const lastFocusedAtRef = useRef<number>(0);

  const [value, setValue] = useState<string>(node.data.name);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { formatMessage } = useI18n();

  useEffect(() => {
    if (isEditing) {
      setValue(node.data.name);
    }
  }, [isEditing, node.data.name]);

  const trimmedValue = value.trim();
  // Derived per node from this row's own input, rather than held as one flag for
  // the whole tree: it is this input that is invalid, and the state has to
  // follow the input's lifetime. Checked as you type so the row can show which
  // name is being refused, instead of the name silently disappearing on submit.
  const hasInvalidName =
    trimmedValue !== '' && !isValidResourceName(trimmedValue);

  const preSubmit = useCallback(
    (trigger: 'enter' | 'blur'): void => {
      if (isSubmitting) {
        return;
      }

      const isNewNode = node.data.name === '';
      const isUnchanged = !isNewNode && trimmedValue === node.data.name;
      if (!trimmedValue || isUnchanged) {
        onEditCancel();
        return;
      }

      if (hasInvalidName) {
        // Enter holds the input open so the name can be corrected in place. A
        // deliberate blur means the user is leaving, so cancel — otherwise the
        // row is stuck in an input that can never be submitted and Escape is
        // the only way out.
        if (trigger === 'blur') {
          onEditCancel();
        } else {
          onValidationError?.();
          inputRef.current?.focus();
        }
        return;
      }

      setIsSubmitting(true);
      onEditSubmit(trimmedValue).finally(() => {
        setIsSubmitting(false);
      });
    },
    [
      hasInvalidName,
      isSubmitting,
      node.data.name,
      onEditCancel,
      onEditSubmit,
      onValidationError,
      trimmedValue,
    ],
  );

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
          className={clsx(styles['tree-node-input'], {
            [styles['tree-node-input--error']]: hasInvalidName,
          })}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          value={value}
          disabled={isSubmitting}
          aria-invalid={hasInvalidName}
          title={
            hasInvalidName
              ? formatMessage(messages.invalidCharactersInName)
              : undefined
          }
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

            preSubmit('blur');
          }}
          onClick={(e): void => e.stopPropagation()}
          onFocus={(): void => {
            lastFocusedAtRef.current = Date.now();
          }}
          onKeyDown={(e): void => {
            e.stopPropagation();

            if (e.key === 'Enter' && !isSubmitting) {
              preSubmit('enter');
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
