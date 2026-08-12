import { TriangleSharpOutline } from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import { Button } from '../Button/Button';
import { Text } from '../Text/Text';
import styles from './prompt.module.scss';

export type PromptState = 'permission' | 'error';

// The action's role drives both its position and its styling:
// - `primary`   emphasized confirm, right side (at most one per prompt)
// - `secondary` plain confirm, right side
// - `cancel`    reject/dismiss, left side, de-emphasized
export type PromptActionRole = 'primary' | 'secondary' | 'cancel';

export interface PromptAction {
  id: string;
  label: string;
  role?: PromptActionRole;
  onClick: VoidFunction;
}

interface PromptProps {
  state: PromptState;
  title: string;
  description?: string;
  actions: PromptAction[];
  children?: React.ReactNode;
}

export const Prompt: React.FC<PromptProps> = ({
  state,
  title,
  description,
  actions,
  children,
}) => {
  const isError = state === 'error';

  const renderAction = ({
    action,
    isPrimary,
  }: {
    action: PromptAction;
    isPrimary: boolean;
  }): React.ReactNode => (
    <Button
      key={action.id}
      variant={isPrimary ? ButtonVariant.Primary : ButtonVariant.Secondary}
      appearance={
        isPrimary ? ButtonAppearance.Action : ButtonAppearance.LowContrast
      }
      size="small"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );

  // Cancel actions sit on the left; everything else on the right.
  const leftActions = actions.filter((action) => action.role === 'cancel');
  const rightActions = actions.filter((action) => action.role !== 'cancel');

  // At most one action is primary, regardless of how many are marked as such.
  const primaryId = actions.find((action) => action.role === 'primary')?.id;

  return (
    <div
      className={clsx(styles['prompt'], isError && styles['prompt--error'])}
      role="group"
      aria-label={title}
    >
      <div className={styles['prompt-header']}>
        {isError && (
          <TriangleSharpOutline
            className={styles['prompt-icon']}
            aria-hidden="true"
          />
        )}
        <Text className={styles['prompt-title']}>{title}</Text>
      </div>

      {description && (
        <Text className={styles['prompt-description']}>{description}</Text>
      )}

      {children}

      {actions.length > 0 && (
        <div className={styles['prompt-footer']}>
          <div className={styles['prompt-footer-group']}>
            {leftActions.map((action) =>
              renderAction({ action, isPrimary: action.id === primaryId }),
            )}
          </div>
          <div className={styles['prompt-footer-group']}>
            {rightActions.map((action) =>
              renderAction({ action, isPrimary: action.id === primaryId }),
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Prompt;
