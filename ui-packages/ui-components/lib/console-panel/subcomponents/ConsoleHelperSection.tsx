import { ManagedOtaErrors } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';

import { useI18n } from '../../i18n/useI18n';
import styles from '../console-panel.module.scss';
import { ConsolePanelStatus } from '../consolePanel.type';
import { messages } from '../messages';
import { getErrorPanel } from './errorPanels';

interface ConsoleHelperProps {
  status: ConsolePanelStatus;
  errReason?: ManagedOtaErrors;
}

const ConsoleHelperSection: React.FC<ConsoleHelperProps> = (
  props: ConsoleHelperProps,
) => {
  const { status, errReason } = props;
  const { formatMessage } = useI18n();

  //Logic according to status here
  const isLoading = status === ConsolePanelStatus.VERIFYING;

  const getTimeoutMessage = (
    status: ConsolePanelStatus,
  ): JSX.Element | string => {
    const message = {
      VERIFYING: formatMessage(messages.verifyTimeout),
      //Add timeout messages here
    };

    switch (status) {
      case ConsolePanelStatus.VERIFYING:
        return message.VERIFYING;
      //Add cases here
      default:
        return '';
    }
  };

  const getMessage = (
    status: ConsolePanelStatus,
    errReason?: ManagedOtaErrors,
  ): JSX.Element | string => {
    switch (status) {
      case ConsolePanelStatus.ERROR: {
        if (!errReason) return '';
        return getErrorPanel(errReason);
      }
      //Add cases here
      default:
        return '';
    }
  };

  //Add timeout messages here, they will show after 30secs
  const timeoutMessage = getTimeoutMessage(status);

  //Add standard messages here
  const message = getMessage(status, errReason);
  return (
    <section
      className={clsx({
        [styles['helper-section--error']]: status === ConsolePanelStatus.ERROR,
      })}
    >
      {isLoading ? <div className={styles['loader-dots']} /> : null}
      {timeoutMessage ? (
        <div className={styles['timeout-message']}>{timeoutMessage}</div>
      ) : null}
      {message ? <div className={styles['message']}>{message}</div> : null}
    </section>
  );
};

export default ConsoleHelperSection;
