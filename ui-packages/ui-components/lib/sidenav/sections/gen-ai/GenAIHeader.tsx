import {
  CloseX,
  EraserIcon,
  InfoIconOutline,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useContext, useEffect } from 'react';

import { Button, ButtonType } from '../../../essential/button';
import { IconButton } from '../../../essential/icon-button';
import { useI18n } from '../../../i18n/useI18n';
import { useTooltip } from '../../../tooltip';
import { TextSize, XXSmall } from '../../../typography';
import { SidenavContext } from '../../context/sidenavContext';
import styles from './gen-ai.module.scss';
import { headerMessages } from './messages';

const NOTIFICATION_TIMEOUT = 7000;
export const GenAIHeader: React.FC = () => {
  const {
    clearChat,
    clearChatConfirm,
    restoreChat,
    isConversationEmpty,
    isClearChatNotificationOpen,
    stopGeneration,
    isLegalDisclaimerAccepted,
  } = useContext(SidenavContext);

  const { formatMessage } = useI18n();

  useEffect(() => {
    if (isClearChatNotificationOpen) {
      setTimeout(() => {
        clearChatConfirm();
      }, NOTIFICATION_TIMEOUT);
    }
  }, [clearChatConfirm, isClearChatNotificationOpen]);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(headerMessages.clearChatButton),
    timeout: 0,
    renderDelay: 1000,
    tooltipType: 'title',
  });

  return isLegalDisclaimerAccepted ? (
    <div className={styles['header-container']}>
      <IconButton
        label={formatMessage(headerMessages.clearChatButton)}
        Icon={EraserIcon}
        classes={{
          button: styles['sidenav-content-clear-chat'],
        }}
        onPress={(): void => {
          stopGeneration();
          clearChat();
        }}
        isDisabled={isConversationEmpty}
        {...tooltipProps}
      />
      {!isConversationEmpty && renderTooltip()}
      {isClearChatNotificationOpen ? (
        <div className={styles.container}>
          <div className={styles.notification}>
            <div className={styles.messageContainer}>
              <InfoIconOutline />
              <XXSmall bold className={clsx(styles.text)}>
                {formatMessage(headerMessages.chatDeleted)}
              </XXSmall>
            </div>

            <div className={styles.action}>
              <Button
                type={ButtonType.Tertiary}
                classes={{ button: styles.actionButton }}
                onClick={(): void => {
                  restoreChat();
                }}
                size={TextSize.XXSmall}
              >
                {formatMessage(headerMessages.undoButton)}
              </Button>
            </div>

            <div className={styles.action}>
              <IconButton
                Icon={CloseX}
                label={formatMessage(headerMessages.closeButton)}
                classes={{ button: styles.closeButton }}
                onPress={(): void => {
                  clearChatConfirm();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;
};
