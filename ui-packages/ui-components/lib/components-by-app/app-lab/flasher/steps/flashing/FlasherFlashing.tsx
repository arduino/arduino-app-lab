import { Success, TriangleSharp } from '@cloud-editor-mono/images/assets/icons';
import { FlashEvent } from '@cloud-editor-mono/infrastructure';
import {
  Button,
  ButtonVariant,
  useI18n,
  XSmall,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import styles from '../../flasher.module.scss';
import { messages } from '../../messages';
import stepStyles from './flasher-flashing.module.scss';

interface FlasherFlashingProps {
  flashEvent: FlashEvent;
  succeeded: boolean | null;
  onConfirm: () => void;
  onRetry: () => void;
  openArduinoSupport: () => void;
}

const WAITING_TIMEOUT_MS = 30000;

export const FlasherFlashing: React.FC<FlasherFlashingProps> = ({
  flashEvent,
  succeeded,
  onConfirm,
  onRetry,
  openArduinoSupport,
}: FlasherFlashingProps) => {
  const { formatMessage } = useI18n();
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [showWaiting, setShowWaiting] = useState(false);

  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (flashEvent.log) {
      setLogs((prevLogs) => [...prevLogs, flashEvent.log!]);
    }
    const timeout = setTimeout(() => {
      setShowWaiting(true);
    }, WAITING_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [flashEvent]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      const el = logsContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (succeeded !== null) {
      setShowLogs(false);
    }
  }, [succeeded]);

  const handleLogsScroll = (): void => {
    if (!logsContainerRef.current) return;

    const el = logsContainerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 5;

    setAutoScroll(isAtBottom);
  };

  return (
    <div className={styles['step-container']}>
      <div className={styles['step-card']}>
        <div className={stepStyles['container']}>
          <div
            className={clsx(stepStyles['title-container'], {
              [stepStyles['logs-visible']]: showLogs,
            })}
          >
            {succeeded === null ? (
              <div className={stepStyles['title-indicator']}>
                <XXXSmall>
                  {formatMessage(messages.flashingStepFlashingLabel, {
                    progress: flashEvent.progress,
                    total: flashEvent.total,
                  })}
                  {showWaiting && (
                    <b>
                      {' '}
                      {formatMessage(messages.flashingStepFlashingWaitingLabel)}
                    </b>
                  )}
                </XXXSmall>
                <div className={styles['waiting-indicator']}>
                  <div className={styles['indicator']} />
                </div>
              </div>
            ) : (
              <div
                className={clsx(stepStyles['title-completed-container'], {
                  [stepStyles['success']]: succeeded,
                })}
              >
                {succeeded ? <Success /> : <TriangleSharp />}
                <XXXSmall className={stepStyles['title']}>
                  {formatMessage(
                    succeeded
                      ? messages.flashingStepSucceededLabel
                      : messages.flashingStepFailedLabel,
                  )}
                </XXXSmall>
              </div>
            )}
            <button
              className={stepStyles['logs-toggle-button']}
              onClick={(): void => setShowLogs((prev) => !prev)}
            >
              {formatMessage(
                showLogs
                  ? messages.flashingStepHideLogsButton
                  : messages.flashingStepShowLogsButton,
              )}
            </button>
          </div>
          {showLogs && (
            <div
              ref={logsContainerRef}
              className={stepStyles['logs-container']}
              onScroll={handleLogsScroll}
            >
              {logs.map((log, index) => (
                <XXSmall key={index} className={stepStyles['log-entry']}>
                  {log}
                </XXSmall>
              ))}
            </div>
          )}
        </div>
        {succeeded ? (
          <>
            <XSmall>
              {formatMessage(messages.flashingStepSucceededInstructions)}
            </XSmall>
            <ol className={stepStyles['instruction-list']}>
              <li className={stepStyles['instruction-list-item']}>
                <XSmall>
                  {formatMessage(messages.flashingStepSucceededInstruction1)}
                </XSmall>
              </li>
              <li className={stepStyles['instruction-list-item']}>
                <XSmall>
                  {formatMessage(messages.flashingStepSucceededInstruction2)}
                </XSmall>
              </li>
              <li className={stepStyles['instruction-list-item']}>
                <XSmall>
                  {formatMessage(messages.flashingStepSucceededInstruction3)}
                </XSmall>
              </li>
            </ol>
            <XSmall>
              {formatMessage(messages.flashingStepSucceededDescription, {
                bold: (text: string) => <b>{text}</b>,
                link: (text: string) => (
                  <button
                    className={stepStyles['link']}
                    onClick={openArduinoSupport}
                  >
                    {text}
                  </button>
                ),
              })}
            </XSmall>
          </>
        ) : succeeded === false ? (
          <>
            <XSmall>
              {formatMessage(messages.flashingStepFailedDescription1)}
            </XSmall>
            <XSmall>
              {formatMessage(messages.flashingStepFailedDescription2, {
                link: (text: string) => (
                  <button
                    className={stepStyles['link']}
                    onClick={openArduinoSupport}
                  >
                    {text}
                  </button>
                ),
              })}
            </XSmall>
          </>
        ) : null}
      </div>
      {succeeded !== null && (
        <div className={stepStyles['step-footer']}>
          <Button
            variant={ButtonVariant.Primary}
            onClick={succeeded ? onConfirm : onRetry}
          >
            {formatMessage(
              succeeded
                ? messages.flashingStepSucceededDoneButton
                : messages.flashingStepFailedRetryButton,
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
