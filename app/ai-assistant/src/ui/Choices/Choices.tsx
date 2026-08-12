import {
  ChatEnter,
  Checkmark,
  ChevronDown,
  CloseX,
} from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
  TextSize,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useState } from 'react';

import { Button } from '../Button/Button';
import { Text } from '../Text/Text';
import styles from './choices.module.scss';

export interface Choice {
  id: string;
  label: string;
  description?: string;
}

// What the user picked: the selected choice ids plus the free-text "Other" value
// when that option was used. `other` is omitted when the free-text field is empty.
export interface ChoicesSubmission {
  selectedIds: string[];
  other?: string;
}

interface ChoicesProps {
  title: string;
  // "1/4" pager for a question that is one step of a multi-question batch; rendered as
  // "Step 1/4 — <title>" in the header.
  counter?: string;
  choices: Choice[];
  // Single-select (radio) by default; multiple lets several be picked at once.
  multiple?: boolean;
  // Show the free-text "Other" option after the listed choices.
  allowOther?: boolean;
  otherPlaceholder?: string;
  submitLabel?: string;
  skipLabel?: string;
  onSubmit: (submission: ChoicesSubmission) => void;
  // Skip = an explicit "no preference" answer (the turn proceeds).
  onSkip?: VoidFunction;
  // Close = dismiss the panel from the thread; distinct from Skip (no answer sent).
  onClose?: VoidFunction;
  closeLabel?: string;
  // Start collapsed (title only, body hidden); expandable from the header chevron.
  defaultCollapsed?: boolean;
}

// A dedicated id for the "Other" option so it lives in the same selection set as
// the listed choices (kept out of the submitted `selectedIds`).
const OTHER_ID = '__other__';

export const Choices: React.FC<ChoicesProps> = ({
  title,
  counter,
  choices,
  multiple = false,
  allowOther = false,
  otherPlaceholder = 'Type your own answer here',
  submitLabel = 'Submit',
  skipLabel = 'Skip',
  onSubmit,
  onSkip,
  onClose,
  closeLabel = 'Close',
  defaultCollapsed = false,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState('');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = (id: string): void => {
    setSelected((prev) => {
      if (multiple) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      // Single-select: the clicked option replaces the current one.
      return new Set([id]);
    });
  };

  const isChecked = (id: string): boolean => selected.has(id);
  const otherChecked = selected.has(OTHER_ID);

  const toggleOther = (): void => {
    setSelected((prev) => {
      if (prev.has(OTHER_ID)) {
        const next = new Set(prev);
        next.delete(OTHER_ID);
        return next;
      }
      return multiple ? new Set(prev).add(OTHER_ID) : new Set([OTHER_ID]);
    });
  };

  const onOtherChange = (value: string): void => {
    setOtherText(value);
    const hasText = value.trim().length > 0;
    if (hasText !== otherChecked) {
      toggleOther();
    }
  };

  const listedSelected = [...selected].filter((id) => id !== OTHER_ID);
  const hasOther = otherChecked && otherText.trim().length > 0;
  const canSubmit = listedSelected.length > 0 || hasOther;

  const submit = (): void => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      selectedIds: listedSelected,
      other: hasOther ? otherText.trim() : undefined,
    });
  };

  // Enter confirms the current selection (Submit / Next), matching the ChatEnter icon on the primary
  // button. It hangs off the answer controls themselves (options and the "Other" field) rather than
  // the card, so the footer and header buttons (Skip, Close, expand) keep their native Enter and
  // options are still toggled with Space.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
      return;
    }
    e.preventDefault();
    submit();
  };

  // WebKit (the desktop app's webview) doesn't focus a <button> on click, so after picking an option
  // focus would stay on the composer and Enter would never reach the handler above. Keep it on the
  // control the user just clicked.
  const keepFocus = (e: React.MouseEvent<HTMLButtonElement>): void =>
    e.currentTarget.focus();

  const role = multiple ? 'checkbox' : 'radio';
  const badgeNumber = (index: number): number => index + 1;

  // Multiple-choice shows a checkbox that mirrors the option's selected state;
  // single-select keeps the numbered badge (its keyboard shortcut).
  const renderIndicator = (checked: boolean, index: number): React.ReactNode =>
    multiple ? (
      <span
        className={clsx(
          styles['choices-checkbox'],
          checked && styles['choices-checkbox--checked'],
        )}
        aria-hidden="true"
      >
        {checked && (
          <Checkmark
            className={styles['choices-check-icon']}
            aria-hidden="true"
          />
        )}
      </span>
    ) : (
      <span className={styles['choices-badge']} aria-hidden="true">
        {badgeNumber(index)}
      </span>
    );

  return (
    <div className={styles['choices']} role="group" aria-label={title}>
      <div className={styles['choices-header']}>
        <span className={styles['choices-dot']} aria-hidden="true" />
        <Text className={styles['choices-title']}>
          {counter ? `Step ${counter} — ${title}` : title}
        </Text>
        <div className={styles['choices-header-actions']}>
          <button
            type="button"
            className={styles['choices-icon-button']}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={(): void => setCollapsed((prev) => !prev)}
          >
            <ChevronDown
              className={clsx(
                styles['choices-chevron'],
                collapsed && styles['choices-chevron--collapsed'],
              )}
              aria-hidden="true"
            />
          </button>
          {onClose && (
            <button
              type="button"
              className={styles['choices-icon-button']}
              aria-label={closeLabel}
              onClick={onClose}
            >
              <CloseX
                className={styles['choices-close-icon']}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            className={styles['choices-options']}
            role={multiple ? 'group' : 'radiogroup'}
          >
            {choices.map((choice, index) => (
              <button
                key={choice.id}
                type="button"
                role={role}
                aria-checked={isChecked(choice.id)}
                className={clsx(
                  styles['choices-option'],
                  isChecked(choice.id) && styles['choices-option--selected'],
                )}
                onClick={(e): void => {
                  keepFocus(e);
                  toggle(choice.id);
                }}
                onKeyDown={onKeyDown}
              >
                <span className={styles['choices-option-body']}>
                  <Text className={styles['choices-option-label']}>
                    {choice.label}
                  </Text>
                  {choice.description && (
                    <Text
                      size={TextSize.XXSmall}
                      className={styles['choices-option-description']}
                    >
                      {choice.description}
                    </Text>
                  )}
                </span>
                {renderIndicator(isChecked(choice.id), index)}
              </button>
            ))}

            {allowOther && (
              <div
                className={clsx(
                  styles['choices-option'],
                  styles['choices-other'],
                  otherChecked && styles['choices-option--selected'],
                )}
              >
                <div className={styles['choices-other-body']}>
                  <button
                    type="button"
                    role={role}
                    aria-checked={otherChecked}
                    className={styles['choices-other-head']}
                    onClick={(e): void => {
                      keepFocus(e);
                      toggleOther();
                    }}
                    onKeyDown={onKeyDown}
                  >
                    <Text className={styles['choices-option-label']}>
                      Other
                    </Text>
                    {renderIndicator(otherChecked, choices.length)}
                  </button>
                  <input
                    type="text"
                    className={styles['choices-other-input']}
                    placeholder={otherPlaceholder}
                    value={otherText}
                    onChange={(e): void => onOtherChange(e.target.value)}
                    onKeyDown={onKeyDown}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles['choices-footer']}>
            {onSkip && (
              <Button
                variant={ButtonVariant.Secondary}
                appearance={ButtonAppearance.LowContrast}
                size="small"
                onClick={onSkip}
              >
                {skipLabel}
              </Button>
            )}
            <Button
              variant={ButtonVariant.Primary}
              appearance={ButtonAppearance.Action}
              size="small"
              disabled={!canSubmit}
              Icon={ChatEnter}
              iconPosition="right"
              onClick={submit}
            >
              {submitLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Choices;
