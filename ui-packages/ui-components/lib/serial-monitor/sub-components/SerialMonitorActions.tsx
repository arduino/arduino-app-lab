import clsx from 'clsx';
import { memo } from 'react';

import { ProgressBar } from '../../essential/progress-bar';
import useSelectLineEnding from '../hooks/useSelectLineEnding';
import {
  SerialMonitorActionsProps,
  SerialMonitorStatus,
} from '../SerialMonitor.type';
import BaudRateSelector from './BaudrateSelector';
import LineEndingSelector from './LineEndingSelector';
import Send from './Send';
import styles from './serial-monitor-actions.module.scss';

const SerialMonitorActions: React.FC<SerialMonitorActionsProps> = (
  props: SerialMonitorActionsProps,
) => {
  const {
    baudRates,
    selectedBaudRate,
    onBaudRateSelected,
    status,
    disabled,
    classes,
    placeholder,
    onMessageSend,
    scrollToBottom,
  } = props;

  const { lineEndings, selectedLineEnding, onLineEndingSelected } =
    useSelectLineEnding();

  const disabledOrPaused = disabled || status === SerialMonitorStatus.Paused;
  const isUploading = status === SerialMonitorStatus.Uploading;

  return (
    <div
      className={clsx(
        styles['serial-monitor-actions'],
        isUploading && styles['serial-monitor-actions-no-border'],
        classes?.wrapper,
      )}
    >
      <ProgressBar active={isUploading} />
      <BaudRateSelector
        baudRates={baudRates}
        selectedBaudRate={selectedBaudRate}
        disabled={disabledOrPaused}
        onBaudRateSelected={onBaudRateSelected}
        classes={classes?.selector}
      />
      <LineEndingSelector
        lineEndings={lineEndings}
        onLineEndingSelected={onLineEndingSelected}
        disabled={disabledOrPaused}
        selectedLineEnding={selectedLineEnding}
        classes={classes?.selector}
      />
      <Send
        onSend={onMessageSend}
        scrollToBottom={scrollToBottom}
        disabled={disabledOrPaused}
        selectedLineEnding={selectedLineEnding}
        classes={classes?.input}
        placeholder={placeholder}
      />
    </div>
  );
};

SerialMonitorActions.displayName = 'SerialMonitorActions';

export default memo(SerialMonitorActions);
