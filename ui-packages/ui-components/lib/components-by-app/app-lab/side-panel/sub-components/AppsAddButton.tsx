import { PlusSmall } from '@cloud-editor-mono/images/assets/icons';
import { Ref } from 'react';

import { useI18n } from '../../../../i18n/useI18n';
import { AppActionsMenu } from '../../app-actions-menu';
import { messages } from '../messages';
import styles from './apps-add-button.module.scss';

export interface AppsAddButtonProps {
  onCreateApp: () => void;
  onImportApp: () => void;
}

// The Apps "+" in the nav sidebar: opens the shared create/import app menu.
export const AppsAddButton = ({
  onCreateApp,
  onImportApp,
}: AppsAddButtonProps): JSX.Element => {
  const { formatMessage } = useI18n();

  return (
    <AppActionsMenu
      onCreateApp={onCreateApp}
      onImportApp={onImportApp}
      title={formatMessage(messages.createAppTooltip)}
      classes={{ dropdownMenuButtonWrapper: styles['button-wrapper'] }}
      buttonChildren={(buttonProps, buttonRef): JSX.Element => (
        <button
          {...buttonProps}
          ref={buttonRef as Ref<HTMLButtonElement>}
          type="button"
          className={styles['button']}
          aria-label={formatMessage(messages.createAppTooltip)}
        >
          <PlusSmall />
        </button>
      )}
    />
  );
};
