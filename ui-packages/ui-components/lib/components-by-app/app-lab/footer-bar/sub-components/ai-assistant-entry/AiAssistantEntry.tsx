import { CodeIcon, Sparkle } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  ButtonVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import styles from './ai-assistant-entry.module.scss';

interface AiAssistantEntryProps {
  agentLabel: string;
  editorLabel: string;
  // Which mode we are in: the pill shows the label of the mode it switches *to*.
  agentModeActive: boolean;
  onClick?: () => void;
  // Loops a highlight sweep over the button, until agent mode is opened from it once.
  shine?: boolean;
}

// Secondary/Action is the accent pill: --text-accent on --component-bg-selected.
// XXSmall keeps the 28px height, 8px radius and 12px/600 label of the footer.
export const AiAssistantEntry: React.FC<AiAssistantEntryProps> = ({
  agentLabel,
  editorLabel,
  agentModeActive,
  onClick,
  shine = false,
}: AiAssistantEntryProps) => {
  const label = agentModeActive ? editorLabel : agentLabel;
  // The glyph of the mode we switch *to*, mirroring the label.
  const Icon = agentModeActive ? CodeIcon : Sparkle;

  return (
    <Button
      variant={ButtonVariant.Secondary}
      size={ButtonSize.XXSmall}
      classes={{
        button: clsx(styles['entry'], { [styles['shine']]: shine }),
      }}
      aria-label={label}
      onClick={onClick}
    >
      {/* Below the xl breakpoint the footer is too tight for the label, so the pill
          collapses to a 28px square showing only this glyph. */}
      <Icon className={styles['icon']} aria-hidden="true" focusable="false" />
      {/* Both labels are rendered, the other one hidden, so the pill is always as wide as the longer
          of the two and switching modes can't resize it and shift the footer with it. */}
      <span className={styles['label']}>
        <span>{label}</span>
        <span className={styles['label-reserve']} aria-hidden="true">
          {agentModeActive ? agentLabel : editorLabel}
        </span>
      </span>
    </Button>
  );
};
