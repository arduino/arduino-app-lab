import clsx from 'clsx';

import { useMonitorCodeMirror } from './hooks/useMonitorCodeMirror';
import { DEFAULT_SERIAL_MONITOR_CODE_MIRROR_PARAMS } from './hooks/useMonitorCodeMirror/constants';
import styles from './serial-monitor.module.scss';
import { SerialMonitorProps } from './SerialMonitor.type';
import SerialMonitorActions from './sub-components/SerialMonitorActions';
import SerialMonitorContents from './sub-components/SerialMonitorContents';
import SerialMonitorToolbar from './sub-components/SerialMonitorToolbar';

const SerialMonitor: React.FC<SerialMonitorProps> = (
  props: SerialMonitorProps,
) => {
  const {
    serialMonitorLogic,
    resetSource,
    logSource,
    classes,
    hasToolbar = true,
    hasActions = true,
    //Default values for the Serial Monitor on the cloud editor
    codeMirrorParams = DEFAULT_SERIAL_MONITOR_CODE_MIRROR_PARAMS,
    sendMessagePlaceholder,
  } = props;

  const {
    deviceName,
    portName,
    contentUpdateLogic,
    baudRates,
    selectedBaudRate,
    onBaudRateSelected,
    onPlayPause,
    onMessageSend,
    clearMessages,
    status,
    disabled,
  } = serialMonitorLogic(logSource);

  const {
    rootRef: codeMirrorRef,
    searchBtnRef,
    lastLineIsVisible,
    timestampsActive,
    appendContent,
    resetContent,
    scrollToBottom,
    toggleTimestamps,
    exportFile,
    toggleSearchPanel,
  } = useMonitorCodeMirror(status, codeMirrorParams);

  contentUpdateLogic(appendContent, resetContent, resetSource);

  return (
    <div className={clsx(styles['serial-monitor-wrapper'], classes?.wrapper)}>
      {hasToolbar && (
        <SerialMonitorToolbar
          searchBtnRef={searchBtnRef}
          deviceName={deviceName}
          portName={portName}
          onPlayPause={onPlayPause}
          clearLog={clearMessages}
          onToggleTimestamps={toggleTimestamps}
          onToggleSearchPanel={toggleSearchPanel}
          timestampsActive={timestampsActive}
          onFileExport={exportFile}
          status={status}
          disabled={disabled}
        />
      )}
      <SerialMonitorContents
        classes={classes?.contents}
        status={status}
        codeMirrorRef={codeMirrorRef}
        lastLineIsVisible={lastLineIsVisible}
        scrollToBottom={scrollToBottom}
      />
      {hasActions && (
        <SerialMonitorActions
          classes={classes?.actions}
          placeholder={sendMessagePlaceholder}
          baudRates={baudRates}
          selectedBaudRate={selectedBaudRate}
          onBaudRateSelected={onBaudRateSelected}
          onMessageSend={onMessageSend}
          status={status}
          disabled={disabled}
          scrollToBottom={scrollToBottom}
        />
      )}
    </div>
  );
};

export default SerialMonitor;
