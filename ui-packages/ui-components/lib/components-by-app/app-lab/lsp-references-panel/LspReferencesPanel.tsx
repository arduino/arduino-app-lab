import { viewInstances } from '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirrorViewInstances';
import {
  LspReferenceRow,
  LspReferencesResult,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/extensions/lsp/lsp-references/lsp-references-types';
import { FileIcon } from '@cloud-editor-mono/images/assets/file-icons';
import { CloseX } from '@cloud-editor-mono/images/assets/icons';
import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import {
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../essential/button/Button.type';
import { IconButton } from '../essential/icon-button/IconButton';
import styles from './lsp-references-panel.module.scss';
import { messages } from './messages';

const PAGE_STEP = 10;

interface LspReferencesPanelProps {
  result: LspReferencesResult;
  onClose: () => void;
  onOpenRow: (row: LspReferenceRow) => void;
}

export const LspReferencesPanel: React.FC<LspReferencesPanelProps> = ({
  result,
  onClose,
  onOpenRow,
}: LspReferencesPanelProps) => {
  const { formatMessage } = useI18n();
  const listRef = useRef<HTMLDivElement | null>(null);
  const domIdPrefix = useId();

  const rows = useMemo(
    () => result.groups.flatMap((group) => group.rows),
    [result],
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // A fresh search selects its first result
  useEffect(() => {
    setSelectedId(rows[0]?.id ?? null);
  }, [rows]);

  useEffect(() => {
    listRef.current?.focus();
  }, [result]);

  const rowDomId = useCallback(
    (index: number): string => `${domIdPrefix}-row-${index}`,
    [domIdPrefix],
  );

  const selectedIndex = rows.findIndex((row) => row.id === selectedId);

  // Keep the selected row visible when it moved under the keyboard rather than
  // the pointer.
  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }
    document
      .getElementById(rowDomId(selectedIndex))
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, rowDomId]);

  const moveSelection = useCallback(
    (delta: number): void => {
      if (rows.length === 0) {
        return;
      }
      const from = selectedIndex < 0 ? 0 : selectedIndex;
      const next = Math.min(Math.max(from + delta, 0), rows.length - 1);
      setSelectedId(rows[next].id);
    },
    [rows, selectedIndex],
  );

  const open = useCallback(
    (row: LspReferenceRow): void => {
      setSelectedId(row.id);
      onOpenRow(row);
    },
    [onOpenRow],
  );

  const close = useCallback((): void => {
    onClose();
    viewInstances[result.originViewInstanceId].instance?.focus();
  }, [onClose, result]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const handlers: Record<string, () => void> = {
        ArrowDown: () => moveSelection(1),
        ArrowUp: () => moveSelection(-1),
        PageDown: () => moveSelection(PAGE_STEP),
        PageUp: () => moveSelection(-PAGE_STEP),
        Home: () => moveSelection(-rows.length),
        End: () => moveSelection(rows.length),
        Escape: close,
        Enter: () => {
          if (selectedIndex >= 0) {
            open(rows[selectedIndex]);
          }
        },
      };
      // Space activates the selection like Enter, but only ' ' is a valid key.
      const handler = event.key === ' ' ? handlers.Enter : handlers[event.key];
      if (!handler) {
        return;
      }
      event.preventDefault();
      handler();
    },
    [close, moveSelection, open, rows, selectedIndex],
  );

  let rowIndex = -1;

  return (
    <div className={styles['lsp-references-panel']}>
      <div className={styles['lsp-references-panel__header']}>
        <p className={styles['lsp-references-panel__title']}>
          {formatMessage(messages.panelTitle)}
        </p>
        <IconButton
          size={ButtonSize.XXSmall}
          variant={ButtonVariant.Tertiary}
          appearance={ButtonAppearance.LowContrast}
          label={formatMessage(messages.close)}
          Icon={CloseX}
          onClick={close}
        />
      </div>

      <div
        ref={listRef}
        className={styles['lsp-references-panel__list']}
        role="listbox"
        tabIndex={0}
        aria-label={
          result.symbol
            ? formatMessage(messages.referencesToSymbol, {
                symbol: result.symbol,
              })
            : formatMessage(messages.references)
        }
        aria-activedescendant={
          selectedIndex >= 0 ? rowDomId(selectedIndex) : undefined
        }
        onKeyDown={onKeyDown}
      >
        {result.groups.map((group) => (
          <div
            key={group.fileUri}
            className={styles['group']}
            role="group"
            aria-label={group.fileName}
          >
            <div className={styles['group__header']}>
              <FileIcon
                fileName={group.fileName}
                width={24}
                height={24}
                className={styles['group__icon']}
              />
              <span className={styles['group__name']}>{group.fileName}</span>
            </div>

            {group.rows.map((row) => {
              rowIndex += 1;
              return (
                // Options in an `aria-activedescendant` listbox are deliberately
                // neither focusable nor individually key-bound: the listbox owns
                // the tab stop and handles every key, which is what lets Arrow
                // keys cross group boundaries. Making each row focusable would
                // put a tab stop on every reference.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
                <div
                  key={row.id}
                  id={rowDomId(rowIndex)}
                  className={styles['row']}
                  role="option"
                  aria-selected={row.id === selectedId}
                  aria-label={formatMessage(messages.referenceAtLine, {
                    fileName: group.fileName,
                    lineNumber: row.lineNumber,
                    excerpt: row.excerpt,
                  })}
                  onClick={(): void => open(row)}
                >
                  <span className={styles['row__line-number']}>
                    {row.lineNumber}:
                  </span>
                  <span className={styles['row__code']}>
                    {row.excerpt.slice(0, row.matchStart)}
                    <strong className={styles['row__match']}>
                      {row.excerpt.slice(row.matchStart, row.matchEnd)}
                    </strong>
                    {row.excerpt.slice(row.matchEnd)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
