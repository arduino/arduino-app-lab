import {
  AccountSettings,
  UserProfileOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';

import { useI18n } from '../../../../i18n/useI18n';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../../essential/button';
import { IconButton } from '../../essential/icon-button';
import { useTooltip } from '../../essential/tooltip';
import { messages } from '../messages';
import { SidePanelItemId } from '../sidePanel.type';
import styles from './bottom.module.scss';

export interface BottomProps {
  initials?: string;
  activeItemId?: string;
}

export const Bottom = ({
  initials,
  activeItemId,
}: BottomProps): JSX.Element => {
  const { formatMessage } = useI18n();
  const navigate = useNavigate();

  const { props: accountTooltipProps, renderTooltip: renderAccountTooltip } =
    useTooltip({
      content: formatMessage(messages.accountLabel),
      timeout: 0,
      renderDelay: 500,
    });

  return (
    <div className={styles['bottom']}>
      <div
        className={styles['account-tooltip-trigger']}
        {...accountTooltipProps}
      >
        <Button
          appearance={ButtonAppearance.LowContrast}
          variant={ButtonVariant.Tertiary}
          size={ButtonSize.XSmall}
          Icon={initials ? undefined : UserProfileOutline}
          bold
          aria-label={formatMessage(messages.accountLabel)}
          classes={{
            button: clsx(styles['account-button'], {
              [styles['selected']]: activeItemId === SidePanelItemId.Account,
            }),
          }}
          onClick={(): void => {
            void navigate({ to: '/account' });
          }}
        >
          {initials}
        </Button>
        {renderAccountTooltip()}
      </div>
      <IconButton
        appearance={ButtonAppearance.LowContrast}
        variant={ButtonVariant.Tertiary}
        size={ButtonSize.Small}
        Icon={AccountSettings}
        label={formatMessage(messages.settingsLabel)}
        classes={{
          button: clsx({
            [styles['selected']]: activeItemId === SidePanelItemId.Settings,
          }),
          icon: styles['settings-icon'],
        }}
        onClick={(): void => {
          void navigate({ to: '/settings' });
        }}
      />
    </div>
  );
};
