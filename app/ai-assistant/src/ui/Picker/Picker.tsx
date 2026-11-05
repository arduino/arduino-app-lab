import {
  Checkmark,
  ChevronRight,
} from '@cloud-editor-mono/images/assets/icons';
import { useTooltip } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { usePickerDismiss } from '../../utils';
import styles from './picker.module.scss';
import { submenuPosition } from './submenuPosition';

export { default as pickerStyles } from './picker.module.scss';

export interface PickerOptionContent {
  label: string;
  // A plain glyph (e.g. an app's emoji) or a pre-rendered element (e.g. a session-state dot) —
  // either way rendered as a real flex sibling of the label, 8px apart, rather than folded into
  // the label text itself.
  Icon?: string | React.ReactElement;
  // Shown as a hover tooltip on the option row — omit for rows that don't need one.
  description?: string;
  // Shown in the row, after the label, in the subtle colour.
  hint?: string;
  // Renders a thin divider right after this option.
  dividerAfter?: boolean;
  // A label row above this option, naming the group it starts.
  groupLabel?: string;
  // The option opens a second level instead of being picked; `expanded` while that level is open.
  submenu?: boolean;
  expanded?: boolean;
}

// Where the open second level is placed: beside `row`, outside `menu`.
export interface PickerSubmenuAnchor {
  menu: HTMLElement;
  row: HTMLElement;
  // Set on the second level, so a click in it does not dismiss the Picker.
  submenuRef: React.RefObject<HTMLUListElement>;
}

export interface PickerProps<T extends { id: string }> {
  items: T[];
  isOpen: boolean;
  onSelect: (id: string) => void;
  // Only one Picker is ever open at a time, so each one owns its own outside-click/Escape
  // dismiss instead of relying on a caller-supplied ref.
  onClose: VoidFunction;
  isSelected: (item: T) => boolean;
  getOption: (item: T) => PickerOptionContent;
  // Trigger visuals differ per consumer (icon-only button, label + chevron, …) — the shared part
  // is the menu underneath it, not the button that opens it. Wires its own onClick/onToggle.
  renderTrigger: (isOpen: boolean) => React.ReactNode;
  emptyState?: React.ReactNode;
  // Header row above the options; also labels the listbox.
  title?: string;
  // Row height. 'small' is the design system's 28px row, used by the sessions history.
  rowSize?: 'small';
  // Which edge the menu is pinned to: one at the left edge has to open the other way, or it
  // extends past its host and gets clipped by its overflow.
  align?: 'left' | 'right';
  // Pickers docked near the top of their host open downward; ones docked near the bottom (the
  // chat composer) open upward so the menu doesn't run off the bottom edge.
  direction?: 'up' | 'down';
  classes?: { container?: string; menu?: string };
  // The second level of the option marked `expanded`. Rendered in a portal: a narrow host, such as
  // the docked side panel, would clip it.
  renderSubmenu?: (anchor: PickerSubmenuAnchor) => React.ReactNode;
}

// The option buttons of a list, in order: group labels and dividers take no focus.
const optionButtons = (list: HTMLElement): HTMLButtonElement[] =>
  Array.from(
    list.querySelectorAll<HTMLButtonElement>('li[role="option"] button'),
  );

// Arrow keys walk a list's options, wrapping at either end.
const moveFocus = (list: HTMLElement, step: 1 | -1): void => {
  const buttons = optionButtons(list);
  if (buttons.length === 0) {
    return;
  }
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    at === -1
      ? step === 1
        ? 0
        : buttons.length - 1
      : (at + step + buttons.length) % buttons.length;
  buttons[next].focus();
};

// Into a list: on its selected option, else on its first.
const focusInto = (list: HTMLElement): void => {
  const selected = list.querySelector<HTMLButtonElement>(
    'li[aria-selected="true"] button',
  );
  (selected ?? optionButtons(list)[0])?.focus();
};

const onArrowKeys = (e: React.KeyboardEvent<HTMLElement>): boolean => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
    return false;
  }
  e.preventDefault();
  moveFocus(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
  return true;
};

interface PickerOptionProps {
  content: PickerOptionContent;
  isSelected: boolean;
  onSelect: VoidFunction;
  small?: boolean;
  // ArrowRight on the row of an open second level moves into it.
  onEnterSubmenu?: VoidFunction;
}

const PickerOption: React.FC<PickerOptionProps> = ({
  content,
  isSelected,
  onSelect,
  small,
  onEnterSubmenu,
}: PickerOptionProps) => {
  const Icon = content.Icon;
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: content.description,
  });

  return (
    <div {...tooltipProps} className={styles['picker-option-wrapper']}>
      <button
        type="button"
        className={clsx(
          styles['picker-option'],
          small && styles['picker-option--small'],
        )}
        data-selected={isSelected}
        aria-haspopup={content.submenu ? 'listbox' : undefined}
        aria-expanded={content.submenu ? Boolean(content.expanded) : undefined}
        onClick={onSelect}
        onKeyDown={(e): void => {
          if (content.submenu && e.key === 'ArrowRight') {
            e.preventDefault();
            if (content.expanded) {
              onEnterSubmenu?.();
            } else {
              onSelect();
            }
          }
        }}
      >
        {Icon &&
          (typeof Icon === 'string' ? (
            <span className={styles['picker-option-glyph']} aria-hidden="true">
              {Icon}
            </span>
          ) : (
            Icon
          ))}
        <span
          className={clsx(
            styles['picker-option-label'],
            content.hint && styles['picker-option-label--hinted'],
          )}
        >
          {content.label}
        </span>
        {content.hint && (
          <span className={styles['picker-option-hint']}>{content.hint}</span>
        )}
        {content.submenu ? (
          <ChevronRight
            className={styles['picker-chevron']}
            aria-hidden="true"
          />
        ) : (
          isSelected && (
            <Checkmark className={styles['picker-check']} aria-hidden="true" />
          )
        )}
      </button>
      {content.description && renderTooltip(styles['picker-tooltip'])}
    </div>
  );
};

export function Picker<T extends { id: string }>({
  items,
  isOpen,
  onSelect,
  onClose,
  isSelected,
  getOption,
  renderTrigger,
  emptyState,
  title,
  rowSize,
  align = 'right',
  direction = 'down',
  classes,
  renderSubmenu,
}: PickerProps<T>): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  // State, not refs: the second level renders once both elements exist.
  const [menu, setMenu] = useState<HTMLUListElement | null>(null);
  const [expandedRow, setExpandedRow] = useState<HTMLElement | null>(null);
  const submenuRef = useRef<HTMLUListElement>(null);
  usePickerDismiss(isOpen, rootRef, onClose, submenuRef);

  return (
    <div ref={rootRef} className={clsx(styles['picker'], classes?.container)}>
      {renderTrigger(isOpen)}
      {isOpen && (
        <ul
          ref={setMenu}
          className={clsx(
            styles['picker-menu'],
            direction === 'up' && styles['picker-menu--up'],
            align === 'left' && styles['picker-menu--left'],
            classes?.menu,
          )}
          role="listbox"
          aria-label={title}
          onKeyDown={onArrowKeys}
        >
          {title && (
            <li role="presentation" className={styles['picker-title']}>
              {title}
            </li>
          )}
          {items.length === 0 && emptyState ? (
            <li className={styles['picker-empty']}>{emptyState}</li>
          ) : (
            <PickerOptions
              items={items}
              isSelected={isSelected}
              getOption={getOption}
              onSelect={onSelect}
              small={rowSize === 'small'}
              expandedRowRef={setExpandedRow}
              onEnterSubmenu={(): void => {
                if (submenuRef.current) {
                  focusInto(submenuRef.current);
                }
              }}
            />
          )}
        </ul>
      )}
      {isOpen &&
        menu &&
        expandedRow &&
        renderSubmenu?.({ menu, row: expandedRow, submenuRef })}
    </div>
  );
}

interface PickerOptionsProps<T extends { id: string }> {
  items: T[];
  isSelected: (item: T) => boolean;
  getOption: (item: T) => PickerOptionContent;
  onSelect: (id: string) => void;
  small?: boolean;
  // Receives the row of the option marked `expanded`.
  expandedRowRef?: (row: HTMLElement | null) => void;
  onEnterSubmenu?: VoidFunction;
}

function PickerOptions<T extends { id: string }>({
  items,
  isSelected,
  getOption,
  onSelect,
  small,
  expandedRowRef,
  onEnterSubmenu,
}: PickerOptionsProps<T>): React.ReactElement {
  return (
    <>
      {items.map((item) => {
        const content = getOption(item);
        return (
          <Fragment key={item.id}>
            {content.groupLabel && (
              <li
                role="presentation"
                className={clsx(
                  styles['picker-title'],
                  styles['picker-group-label'],
                )}
              >
                {content.groupLabel}
              </li>
            )}
            <li
              ref={content.expanded ? expandedRowRef : undefined}
              role="option"
              aria-selected={isSelected(item)}
            >
              <PickerOption
                content={content}
                isSelected={isSelected(item)}
                onSelect={(): void => onSelect(item.id)}
                small={small}
                onEnterSubmenu={onEnterSubmenu}
              />
            </li>
            {content.dividerAfter && (
              <li role="separator" className={styles['picker-divider']} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

interface PickerSubmenuProps<T extends { id: string }> {
  anchor: PickerSubmenuAnchor;
  items: T[];
  isSelected: (item: T) => boolean;
  getOption: (item: T) => PickerOptionContent;
  onSelect: (id: string) => void;
  // Called when the menu scrolls: the anchor row moves, and can leave the menu's visible part.
  onClose: VoidFunction;
  label?: string;
  className?: string;
}

// A Picker's second level, returned from its renderSubmenu.
export function PickerSubmenu<T extends { id: string }>({
  anchor,
  items,
  isSelected,
  getOption,
  onSelect,
  onClose,
  label,
  className,
}: PickerSubmenuProps<T>): React.ReactElement {
  const { menu, row, submenuRef } = anchor;
  const [position, setPosition] = useState<{ top: number; left: number }>();
  // Held in a ref so a caller's inline callback doesn't re-bind the listener on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const focusedRef = useRef(false);

  // Portaled to the body, it sits last in the tab order: focus moves into it once it is placed, where it can take focus.
  useEffect(() => {
    const list = submenuRef.current;
    if (!position || !list || focusedRef.current) {
      return;
    }
    focusedRef.current = true;
    focusInto(list);
  }, [position, submenuRef]);

  // Back to the row it opened from, and only this level closes.
  const closeToRow = (): void => {
    row.querySelector<HTMLElement>('button')?.focus();
    onCloseRef.current();
  };

  // Measured before paint, and again on resize: the list's own size decides where it fits.
  useLayoutEffect(() => {
    const place = (): void => {
      const el = submenuRef.current;
      if (!el) {
        return;
      }
      setPosition(
        submenuPosition(
          {
            menu: menu.getBoundingClientRect(),
            row: row.getBoundingClientRect(),
          },
          { width: el.offsetWidth, height: el.offsetHeight },
          window.innerHeight,
        ),
      );
    };

    const close = (): void => onCloseRef.current();

    place();
    menu.addEventListener('scroll', close);
    window.addEventListener('resize', place);
    return (): void => {
      menu.removeEventListener('scroll', close);
      window.removeEventListener('resize', place);
    };
  }, [menu, row, submenuRef, items]);

  return createPortal(
    <ul
      ref={submenuRef}
      className={clsx(
        styles['picker-menu'],
        styles['picker-submenu'],
        className,
      )}
      style={position ?? { visibility: 'hidden' }}
      role="listbox"
      aria-label={label}
      onKeyDown={(e): void => {
        if (onArrowKeys(e)) {
          return;
        }
        if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation(); // Escape here closes this level only, not the whole menu
          closeToRow();
        }
      }}
    >
      <PickerOptions
        items={items}
        isSelected={isSelected}
        getOption={getOption}
        onSelect={onSelect}
      />
    </ul>,
    document.body,
  );
}
