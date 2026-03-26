import { Error, Warning } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { useI18n, XXSmall, XXXSmall } from '../../../shared';
import { BoardResources } from '../../footer-bar';
import { SettingsSection } from '../../settings-section';
import { deviceMessages } from '../messages';
import styles from '../settings.module.scss';

export interface DeviceStorageProps {
  boardResources?: BoardResources;
  bytesToGiB: (bytes: number) => string;
}

const WARNING_THRESHOLD = 70;
const ERROR_THRESHOLD = 95;
export const DeviceStorage = ({
  boardResources,
  bytesToGiB,
}: DeviceStorageProps): JSX.Element => {
  const { formatMessage } = useI18n();
  const rootDiskUsed = boardResources?.rootDisk?.used ?? 0;
  const rootDiskTotal = boardResources?.rootDisk?.total ?? 0;
  const homeDiskUsed = boardResources?.homeDisk?.used ?? 0;
  const homeDiskTotal = boardResources?.homeDisk?.total ?? 0;
  const diskUsed = rootDiskUsed + homeDiskUsed;
  const diskTotal = rootDiskTotal + homeDiskTotal;

  const rootDiskPercentageUsed =
    rootDiskTotal > 0 ? Math.floor((rootDiskUsed / rootDiskTotal) * 100) : 0;
  const homeDiskPercentageUsed =
    homeDiskTotal > 0 ? Math.floor((homeDiskUsed / homeDiskTotal) * 100) : 0;
  const totalPercentageUsed =
    diskTotal > 0 ? Math.floor((diskUsed / diskTotal) * 100) : 0;

  return (
    <div
      className={clsx(styles['device-storage'], {
        [styles['device-storage-warning']]:
          totalPercentageUsed >= WARNING_THRESHOLD,
        [styles['device-storage-error']]:
          totalPercentageUsed >= ERROR_THRESHOLD,
      })}
    >
      <div className={styles['device-storage-title-container']}>
        {totalPercentageUsed >= ERROR_THRESHOLD ? (
          <Error />
        ) : totalPercentageUsed >= WARNING_THRESHOLD ? (
          <Warning />
        ) : null}
        <XXSmall className={styles['device-storage-title']}>
          {formatMessage(deviceMessages.diskStorageUsage, {
            used: bytesToGiB(diskUsed),
            total: bytesToGiB(diskTotal),
          })}
        </XXSmall>
        <SettingsSection.Info
          title={formatMessage(deviceMessages.diskStorageUsageInfo)}
        >
          <div className={styles['device-storage-info']}>
            <XXXSmall
              className={clsx({
                [styles['device-storage-warning']]:
                  rootDiskPercentageUsed >= WARNING_THRESHOLD,
                [styles['device-storage-error']]:
                  rootDiskPercentageUsed >= ERROR_THRESHOLD,
              })}
            >
              ROOT {bytesToGiB(rootDiskUsed)} / {bytesToGiB(rootDiskTotal)} GB
            </XXXSmall>
            <XXXSmall
              className={clsx({
                [styles['device-storage-warning']]:
                  homeDiskPercentageUsed >= WARNING_THRESHOLD,
                [styles['device-storage-error']]:
                  homeDiskPercentageUsed >= ERROR_THRESHOLD,
              })}
            >
              USER {bytesToGiB(homeDiskUsed)} / {bytesToGiB(homeDiskTotal)} GB
            </XXXSmall>
          </div>
        </SettingsSection.Info>
      </div>
      <div
        className={clsx(styles['progress-bar'], {
          [styles['warning']]: totalPercentageUsed >= WARNING_THRESHOLD,
          [styles['error']]: totalPercentageUsed >= ERROR_THRESHOLD,
        })}
      >
        <div
          className={clsx(
            styles['progress'],
            styles[`p${totalPercentageUsed}`],
          )}
        />
      </div>
      {totalPercentageUsed >= ERROR_THRESHOLD ? (
        <XXXSmall>
          {formatMessage(deviceMessages.diskStorageUsageError)}
        </XXXSmall>
      ) : totalPercentageUsed >= WARNING_THRESHOLD ? (
        <XXXSmall>
          {formatMessage(deviceMessages.diskStorageUsageWarning)}
        </XXXSmall>
      ) : null}
    </div>
  );
};
