import { memo } from 'react';

import AssociatedDeviceInfo from '../../toolbar/sub-components/associated-device-info';
import {
  SerialMonitorStatus,
  SerialMonitorToolbarProps,
} from '../SerialMonitor.type';
import ClearLogButton from './ClearLog';
import ExportFile from './ExportFile';
import PlayPauseButton from './PlayPause';
import Search from './Search';
import styles from './serial-monitor-toolbar.module.scss';
import ToggleTimestamps from './ToggleTimestamps';

const SerialMonitorToolbar: React.FC<SerialMonitorToolbarProps> = (
  props: SerialMonitorToolbarProps,
) => {
  const {
    searchBtnRef,
    deviceName,
    portName,
    onPlayPause,
    clearLog,
    onToggleTimestamps,
    onFileExport,
    onToggleSearchPanel,
    status,
    disabled,
    timestampsActive,
  } = props;

  const disconnected =
    status === SerialMonitorStatus.ActiveUnreachable ||
    status === SerialMonitorStatus.PausedUnreachable;

  return (
    <div className={styles['serial-monitor-toolbar']}>
      <AssociatedDeviceInfo
        board={deviceName}
        port={disconnected ? undefined : portName}
        boardsConfigIsUnknown={false}
        connectionLost={disconnected}
        errored={status === SerialMonitorStatus.Unavailable}
        boardBubbleBadgeNumber={0} // don't visualize badge in SM
        uploading={status === SerialMonitorStatus.Uploading}
        extended
      />
      <PlayPauseButton
        onClick={onPlayPause}
        status={status}
        disabled={disabled}
      />
      <div className={styles['serial-monitor-toolbar-right']}>
        <ToggleTimestamps
          onClick={onToggleTimestamps}
          disabled={disabled}
          timestampsActive={timestampsActive}
        />
        <ExportFile onClick={onFileExport} disabled={disabled} />
        <ClearLogButton onClick={clearLog} disabled={disabled} />
        <Search
          ref={searchBtnRef}
          onClick={onToggleSearchPanel}
          disabled={disabled}
          status={status}
        />
      </div>
    </div>
  );
};

export default memo(SerialMonitorToolbar);
