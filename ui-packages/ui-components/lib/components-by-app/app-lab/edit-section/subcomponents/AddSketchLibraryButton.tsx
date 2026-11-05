import { AddLibrary as AddLibraryIcon } from '@cloud-editor-mono/images/assets/icons';
import { useEffect, useId, useRef, useState } from 'react';

import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../../essential/button';
import { IconButton } from '../../essential/icon-button';
import { useTooltip } from '../../essential/tooltip';
import styles from './add-sketch-library-button.module.scss';

export type AddSketchLibraryPopover = {
  text: string;
  listItems?: string[];
  actionLabel: string;
  onAction: () => void;
};

type AddSketchLibraryButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  // Disabled for now, but focusable: a focused button that turns `disabled`
  // loses focus, and this state passes on its own (a listing loading).
  unavailable?: boolean;
  // Given: the button is disabled and this popover says why and offers the fix.
  popover?: AddSketchLibraryPopover;
};

// The "Add sketch library" button in every state. One component, so the
// button element survives the popover's action enabling it, and keeps focus.
// With a popover the button stays focusable (`aria-disabled`), so the keyboard
// reaches the popover too. The popover is portaled to the end of `body`, so
// Tab into and out of it is moved by hand.
export const AddSketchLibraryButton: React.FC<AddSketchLibraryButtonProps> = ({
  label,
  onClick,
  disabled = false,
  unavailable = false,
  popover,
}: AddSketchLibraryButtonProps) => {
  const { text = '', listItems, actionLabel, onAction } = popover ?? {};
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  // Focus returned to the trigger by the popover must not reopen it.
  const skipFocusOpenRef = useRef(false);
  const [focusInside, setFocusInside] = useState(false);
  const textId = useId();

  // The popover content is built before useTooltip returns its setter, so
  // its handlers reach the setter through this ref.
  const setOpenRef = useRef<(open: boolean) => void>(() => undefined);
  const setOpen = (open: boolean): void => setOpenRef.current(open);

  const returnFocusToTrigger = (): void => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    // focus() on the focused element raises no focus event to clear the flag.
    if (document.activeElement !== trigger) skipFocusOpenRef.current = true;
    trigger.focus();
  };

  const handleBlur = (e: React.FocusEvent): void => {
    const next = e.relatedTarget;
    if (next === triggerRef.current || next === actionRef.current) return;
    setFocusInside(false);
    setOpen(false);
  };

  const handleAction = (): void => {
    setOpen(false);
    returnFocusToTrigger();
    onAction?.();
  };

  const handleActionKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      // Not prevented: the browser moves on from the trigger, as if the
      // popover sat right after it.
      setOpen(false);
      returnFocusToTrigger();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      returnFocusToTrigger();
    }
  };

  const {
    props: tooltipProps,
    renderTooltip,
    setShowTooltip,
    isTooltipVisible,
  } = useTooltip({
    content: (
      <span className={styles['content']}>
        <span id={textId} className={styles['text']}>
          <span>{text}</span>
          {listItems && (
            <ul className={styles['list']}>
              {listItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </span>
        <Button
          ref={actionRef}
          variant={ButtonVariant.Tertiary}
          appearance={ButtonAppearance.Action}
          size={ButtonSize.Small}
          classes={{ button: styles['action'] }}
          onClick={handleAction}
          onKeyDown={handleActionKeyDown}
          onFocus={(): void => setFocusInside(true)}
          onBlur={handleBlur}
        >
          {actionLabel}
        </Button>
      </span>
    ),
    role: 'dialog',
    variant: 'card',
    ariaLabel: [text, ...(listItems ?? [])].join(' '),
    keepOpen: focusInside,
  });

  useEffect(() => {
    setOpenRef.current = setShowTooltip;
  }, [setShowTooltip]);

  const hasPopover = !!popover;
  // The button without a popover has no blur handler, so a stale
  // `focusInside` would keep the next popover open after the mouse leaves.
  useEffect(() => {
    if (!hasPopover) {
      setShowTooltip(false);
      setFocusInside(false);
    }
  }, [hasPopover, setShowTooltip]);

  const handleTriggerFocus = (): void => {
    setFocusInside(true);
    if (skipFocusOpenRef.current) {
      skipFocusOpenRef.current = false;
      return;
    }
    setShowTooltip(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Tab' && !e.shiftKey && isTooltipVisible) {
      e.preventDefault();
      actionRef.current?.focus();
    } else if (e.key === 'Escape') {
      setShowTooltip(false);
    }
  };

  if (!popover) {
    return (
      <div>
        <IconButton
          ref={triggerRef}
          size={ButtonSize.XSmall}
          variant={ButtonVariant.Secondary}
          appearance={ButtonAppearance.LowContrast}
          Icon={AddLibraryIcon}
          label={label}
          onClick={unavailable ? undefined : onClick}
          disabled={disabled}
          aria-disabled={unavailable || undefined}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- onMouseDown only keeps focus in place; the controls inside are native buttons
    <div
      ref={tooltipProps.ref}
      onMouseEnter={tooltipProps.onMouseEnter}
      onMouseLeave={tooltipProps.onMouseLeave}
      // The popover is portaled, but its React events still reach this div.
      // A press inside it must not move focus: WebKit does not focus a pressed
      // button, so focus would leave the trigger for `body` and its blur would
      // close the popover before the click lands.
      onMouseDown={(e): void => e.preventDefault()}
    >
      <IconButton
        ref={triggerRef}
        size={ButtonSize.XSmall}
        variant={ButtonVariant.Secondary}
        appearance={ButtonAppearance.LowContrast}
        Icon={AddLibraryIcon}
        label={label}
        hideTooltip
        aria-disabled="true"
        aria-haspopup="dialog"
        aria-expanded={isTooltipVisible}
        aria-controls={tooltipProps['aria-describedby']}
        aria-describedby={textId}
        onFocus={handleTriggerFocus}
        onBlur={handleBlur}
        onKeyDown={handleTriggerKeyDown}
      />
      {renderTooltip()}
    </div>
  );
};
