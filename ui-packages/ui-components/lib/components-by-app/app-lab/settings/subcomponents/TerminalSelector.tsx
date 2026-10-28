import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  DropdownMenuButton,
  Input,
  InputStyle,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMemo, useState } from 'react';

import { useI18n } from '../../../shared';
import { systemMessages } from '../messages';
import styles from '../settings.module.scss';
import { UseTerminalSettingsLogic } from '../settings.type';

// Ids used by the dropdown menu, they are not terminal names.
const AUTOMATIC_TERMINAL_ID = 'automatic';
const CUSTOM_TERMINAL_ID = 'custom';

export interface TerminalSelectorProps {
  logic: UseTerminalSettingsLogic;
}

export const TerminalSelector = ({
  logic,
}: TerminalSelectorProps): JSX.Element | null => {
  const { formatMessage } = useI18n();
  const { supported, terminals, preference, setPreference } = logic();

  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The dropdown only offers the terminals that are installed, the others are
  // reported so that the user can see that the terminal they selected is gone.
  const installed = useMemo(
    () => terminals.filter((terminal) => terminal.available),
    [terminals],
  );

  const selected = useMemo(
    () => terminals.find((terminal) => terminal.id === preference),
    [preference, terminals],
  );

  const sections = useMemo(
    () => [
      {
        name: formatMessage(systemMessages.terminalSection),
        items: [
          {
            id: AUTOMATIC_TERMINAL_ID,
            label: formatMessage(systemMessages.terminalAutomatic),
          },
          ...installed.map((terminal) => ({
            id: terminal.id,
            label: terminal.label,
          })),
          {
            id: CUSTOM_TERMINAL_ID,
            label: formatMessage(systemMessages.terminalCustom),
          },
        ],
      },
    ],
    [formatMessage, installed],
  );

  const selectedLabel = useMemo(() => {
    if (!preference) {
      return formatMessage(systemMessages.terminalAutomatic);
    }
    if (selected) {
      // The terminal is known but it is not installed any more.
      return selected.available
        ? selected.label
        : formatMessage(systemMessages.terminalNotInstalled, {
            terminal: selected.label,
          });
    }
    return formatMessage(systemMessages.terminalCustomLabel, {
      command: preference,
    });
  }, [formatMessage, preference, selected]);

  const onAction = (key: string): void => {
    if (key === CUSTOM_TERMINAL_ID) {
      // The custom command is not applied until it is confirmed.
      setCustomValue(selected ? '' : preference);
      setError(null);
      setIsCustomOpen(true);
      return;
    }
    setIsCustomOpen(false);
    setError(null);
    void setPreference(key === AUTOMATIC_TERMINAL_ID ? '' : key);
  };

  const saveCustom = async (): Promise<void> => {
    try {
      await setPreference(customValue.trim());
      setIsCustomOpen(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!supported) {
    return null;
  }

  return (
    <>
      <DropdownMenuButton
        sections={sections}
        buttonChildren={
          <>
            {selectedLabel}
            <ChevronDown />
          </>
        }
        // react-aria computes the position against the viewport, which
        // only matches where the popover is placed when it is portaled.
        useStaticPosition={false}
        usePortal
        onAction={(key): void => onAction(String(key))}
        classes={{
          dropdownMenu: styles['dropdown-menu'],
          dropdownMenuButton: styles['dropdown-menu-button'],
          dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
          dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
          dropdownMenuPopover: styles['dropdown-menu-popover'],
        }}
      />
      {isCustomOpen && (
        <div className={styles['terminal-custom']}>
          <Input
            classes={{
              input: styles['terminal-custom-input'],
              inputContainer: styles['terminal-custom-input-container'],
            }}
            inputStyle={InputStyle.AppLab}
            autoFocus
            value={customValue}
            placeholder={formatMessage(
              systemMessages.terminalCustomPlaceholder,
            )}
            monospace
            small
            onChange={(value): void => {
              setCustomValue(value);
              // The error belongs to the value that was rejected.
              setError(null);
            }}
            onEnter={(): void => {
              void saveCustom();
            }}
          />
          <Button
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Secondary}
            appearance={ButtonAppearance.LowContrast}
            disabled={customValue.trim().length === 0}
            onClick={(): void => {
              void saveCustom();
            }}
          >
            {formatMessage(systemMessages.terminalCustomSave)}
          </Button>
          <Button
            size={ButtonSize.XSmall}
            variant={ButtonVariant.Tertiary}
            appearance={ButtonAppearance.LowContrast}
            onClick={(): void => {
              setIsCustomOpen(false);
              setError(null);
            }}
          >
            {formatMessage(systemMessages.terminalCustomCancel)}
          </Button>
          <XXSmall className={styles['terminal-custom-info']}>
            {formatMessage(systemMessages.terminalCustomInfo)}
          </XXSmall>
          {error && (
            <XXSmall className={styles['terminal-error']}>{error}</XXSmall>
          )}
        </div>
      )}
    </>
  );
};
