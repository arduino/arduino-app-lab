import { HardwareStorage } from '@cloud-editor-mono/images/assets/icons';

import { SystemResources } from '../../FooterBar.type';
import { BoardHardware } from '../board-hardware/BoardHardware';

const truncateGB = (value: string): string => {
  if (!value.includes('.')) return value;
  return value.split('.')[0];
};

export interface BoardStorageProps {
  systemResources?: SystemResources;
  boardType?: string;
  bytesToGiB: (bytes: number) => string;
}

const WARNING_THRESHOLD = 90;
export const BoardStorage = ({
  systemResources,
  boardType,
  bytesToGiB,
}: BoardStorageProps): JSX.Element => {
  const isVentuno = boardType?.toLowerCase().includes('ventuno') ?? false;
  const rootDiskUsed = systemResources?.root?.value?.used ?? 0;
  const rootDiskTotal = systemResources?.root?.value?.total ?? 0;
  const homeDiskUsed = systemResources?.user?.value?.used ?? 0;
  const homeDiskTotal = systemResources?.user?.value?.total ?? 0;
  const diskUsed = isVentuno ? rootDiskUsed : rootDiskUsed + homeDiskUsed;
  const diskTotal = isVentuno ? rootDiskTotal : rootDiskTotal + homeDiskTotal;

  const totalPercentageUsed =
    diskTotal > 0 ? Math.floor((diskUsed / diskTotal) * 100) : 0;

  const label = isVentuno
    ? systemResources?.root?.label
    : [systemResources?.root?.label, systemResources?.user?.label].join(' - ');

  return (
    <BoardHardware
      icon={<HardwareStorage />}
      title={`${truncateGB(bytesToGiB(diskUsed))}/${truncateGB(
        bytesToGiB(diskTotal),
      )} GB`}
      label={label}
      warning={totalPercentageUsed >= WARNING_THRESHOLD}
    />
  );
};
