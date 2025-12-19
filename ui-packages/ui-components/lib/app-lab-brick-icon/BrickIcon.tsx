import {
  AppLabBrickApi,
  AppLabBrickAudio,
  AppLabBrickIot,
  AppLabBrickMiscellaneous,
  AppLabBrickStorage,
  AppLabBrickText,
  AppLabBrickUi,
  AppLabBrickVision,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useMemo } from 'react';

import styles from './brick-icon.module.scss';
import { BrickIconProps } from './BrickIcon.type';

const BrickIcon: React.FC<BrickIconProps> = (props: BrickIconProps) => {
  const { category, size = 'large' } = props;

  const Icon = useMemo(() => {
    switch (category) {
      case 'api':
        return AppLabBrickApi;
      case 'audio':
        return AppLabBrickAudio;
      case 'iot':
        return AppLabBrickIot;
      case 'storage':
        return AppLabBrickStorage;
      case 'text':
        return AppLabBrickText;
      case 'ui':
        return AppLabBrickUi;
      case 'image':
      case 'video':
        return AppLabBrickVision;
      default:
        return AppLabBrickMiscellaneous;
    }
  }, [category]);

  return (
    <div
      className={clsx(
        styles['brick-icon'],
        styles[size],
        ...(category ? [styles[category]] : []),
      )}
    >
      <Icon />
    </div>
  );
};

export default BrickIcon;
