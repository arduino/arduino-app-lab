import { ArrowDown, CloseX } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { usePreviousDistinct } from 'react-use';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { XSmall, XXSmall } from '../../typography';
import { messages as translations } from '../messages';
import {
  SerialMonitorContentsProps,
  SerialMonitorStatus,
} from '../SerialMonitor.type';
import styles from './serial-monitor-contents.module.scss';

const SerialMonitorContents: React.FC<SerialMonitorContentsProps> = ({
  status,
  codeMirrorRef,
  lastLineIsVisible,
  scrollToBottom,
  classes,
}: SerialMonitorContentsProps) => {
  const { formatMessage } = useI18n();
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  useEffect(() => {
    setShowErrorMessage(
      status === SerialMonitorStatus.Unavailable ||
        status === SerialMonitorStatus.ActiveUnreachable ||
        status === SerialMonitorStatus.PausedUnreachable,
    );
  }, [status]);

  const closeUnavailableMessage = useCallback(() => {
    setShowErrorMessage(false);
  }, []);

  const previousStatus = usePreviousDistinct(status); // ! sets a ref during render, could get out of sync if we use concurrent mode features

  const renderConnectingLabel = (): JSX.Element => {
    if (status === SerialMonitorStatus.Connecting)
      return (
        <XSmall monospace>{formatMessage(translations.connecting)}</XSmall>
      );

    if (
      previousStatus === SerialMonitorStatus.Connecting &&
      status === SerialMonitorStatus.Starting
    )
      return (
        <XSmall monospace>{formatMessage(translations.connecting)}</XSmall>
      );

    return <></>;
  };

  return (
    <div className={clsx(styles['serial-monitor-contents'], classes?.wrapper)}>
      {renderConnectingLabel()}
      {showErrorMessage && (
        <div className={styles['serial-monitor-error']}>
          <XXSmall>
            {formatMessage(
              status === SerialMonitorStatus.Unavailable
                ? translations.unavailable
                : translations.connectionLost,
            )}
          </XXSmall>
          <CloseX onClick={closeUnavailableMessage} />
        </div>
      )}
      <div id="code-mirror-wrapper" ref={codeMirrorRef} />
      {lastLineIsVisible === false && (
        <IconButton
          onPress={scrollToBottom}
          label={formatMessage(translations.viewNewData)}
          Icon={ArrowDown}
          classes={{
            button: styles['serial-monitor-scroll-down'],
          }}
        >
          <XSmall>{formatMessage(translations.viewNewData)}</XSmall>
        </IconButton>
      )}
    </div>
  );
};

export default SerialMonitorContents;
