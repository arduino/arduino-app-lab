import clsx from 'clsx';

import styles from './device-image.module.scss';
import { DialogImageTypes } from './deviceImage.type';

interface DialogImageProps {
  Icon: React.ReactNode;
  type?: DialogImageTypes;
  classes?: { container: string };
}

const DialogImage: React.FC<DialogImageProps> = (props: DialogImageProps) => {
  const { Icon, type, classes } = props;

  return (
    <div
      className={clsx(
        {
          [styles['device-large']]: type === DialogImageTypes.DeviceLarge,
          [styles['device-medium']]: type === DialogImageTypes.DeviceMedium,
          [styles['device-small']]: type === DialogImageTypes.DeviceSmall,
        },
        classes?.container,
      )}
    >
      {Icon}
    </div>
  );
};

export default DialogImage;
