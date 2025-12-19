import { DeviceImage } from '@cloud-editor-mono/images/assets/devices';
import {
  SelectedDeviceTick,
  Unlink,
  UsbPort,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useContext } from 'react';

import { Button } from '../../../essential/button/Button';
import { ButtonType } from '../../../essential/button/button.type';
import { useI18n } from '../../../i18n/useI18n';
import { TextSize, XSmall } from '../../../typography';
import { DeviceAssociationContext } from '../../context/deviceAssociationContext';
import {
  DeviceAssociationDialogLinks,
  OnSetDetectedBoardAndPort,
} from '../../deviceAssociationDialog.type';
import { UNKNOWN_BOARD_FQBN, UNKNOWN_BOARD_NAME } from '../../utils';
import { messages as messages } from '../messages';
import DialogImage from '../sub-components/device-image/DeviceImage';
import { DialogImageTypes } from '../sub-components/device-image/deviceImage.type';
import DialogContentHeader from '../sub-components/dialog-content-header/DialogContentHeader';
import LabeledDivider from '../sub-components/labeled-divider/LabeledDivider';
import ManualSelectBlock from '../sub-components/manual-select-block/ManualSelectBlock';
import TroubleShootingMessage from '../sub-components/trouble-shooting-message/troubleShootingMessage';
import styles from './detected-one.module.scss';

interface DetectedOneProps {
  onAssociate: OnSetDetectedBoardAndPort;
  onManualSelectChosen: () => void;
}

const DetectedOne: React.FC<DetectedOneProps> = (props: DetectedOneProps) => {
  const { onAssociate, onManualSelectChosen } = props;
  const { detectedDevices, links } = useContext(DeviceAssociationContext);
  const {
    portBoardId: id,
    fqbn,
    name,
    portName,
    isUnknownBoard,
    isAssociated,
  } = detectedDevices[0];
  const { formatMessage } = useI18n();

  return (
    <div className={styles.body}>
      <DialogImage
        Icon={<DeviceImage deviceImageKey={fqbn || UNKNOWN_BOARD_FQBN} />}
        type={DialogImageTypes.DeviceLarge}
      />
      <DialogContentHeader
        title={name || UNKNOWN_BOARD_NAME}
        subtitle={
          <>
            <UsbPort aria-hidden="true" focusable="false" />
            {portName}
          </>
        }
        classes={{
          header: clsx(styles.header, {
            [styles['header-is-associated']]: isAssociated,
          }),
          title: styles.title,
          subtitle: styles.subtitle,
        }}
      />
      <div className={styles['association-content']}>
        {isAssociated ? (
          <div className={styles['detach-container']}>
            <SelectedDeviceTick />
            <XSmall>{formatMessage(messages.associatedToSketch)}</XSmall>
            <Button
              type={ButtonType.Tertiary}
              Icon={Unlink}
              size={TextSize.XSmall}
              onClick={(): void => onAssociate('')}
            >
              {formatMessage(messages.detachButton)}
            </Button>
          </div>
        ) : (
          <>
            <XSmall>
              {formatMessage(messages.readyToBeAssociated, { name })}
            </XSmall>
            <div className={styles['associate-button-container']}>
              <Button
                onClick={(): void => onAssociate(id, portName, isUnknownBoard)}
              >
                {formatMessage(messages.associateButton)}
              </Button>
            </div>
          </>
        )}
        <TroubleShootingMessage
          troubleShootingUrl={
            links[DeviceAssociationDialogLinks.TroubleShootingDevices]
          }
        />
      </div>
      <LabeledDivider label={formatMessage(messages.dividerLabel)} />
      <ManualSelectBlock onClick={onManualSelectChosen} />
    </div>
  );
};

export default DetectedOne;
