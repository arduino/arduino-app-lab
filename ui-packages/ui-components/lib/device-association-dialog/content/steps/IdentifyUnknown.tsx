import { DeviceImage } from '@cloud-editor-mono/images/assets/devices';
import { UsbPort } from '@cloud-editor-mono/images/assets/icons';
import { useContext, useMemo } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { DeviceAssociationContext } from '../../context/deviceAssociationContext';
import { OnSetDetectedUnknownBoard } from '../../deviceAssociationDialog.type';
import { UNKNOWN_BOARD_FQBN } from '../../utils';
import { messages } from '../messages';
import DevicesMoreThanOne from './templates/DevicesMoreThanOne';
import { DevicesListModality } from './templates/devicesMoreThanOne.type';
import styles from './undetected-selection.module.scss';

interface IdentifyUnknownProps {
  onItemSelect: OnSetDetectedUnknownBoard;
}

const IdentifyUnknown: React.FC<IdentifyUnknownProps> = (
  props: IdentifyUnknownProps,
) => {
  const { onItemSelect } = props;
  const { getDevicesListLogic, unknownDeviceToIdentify, usingWebSerial } =
    useContext(DeviceAssociationContext);
  const { formatMessage } = useI18n();

  const { devices, devicesAreLoading } = getDevicesListLogic();

  const devicesFiltered = useMemo(
    () =>
      usingWebSerial
        ? devices.filter((device) => device.webSerialSupport)
        : devices,
    [usingWebSerial, devices],
  );

  const unknownBoardPortHelper = unknownDeviceToIdentify?.portName ? (
    <div className={styles['unknown-board-port-helper']}>
      <div className={styles['unknown-board-port-helper-image']}>
        <DeviceImage deviceImageKey={UNKNOWN_BOARD_FQBN} />
      </div>
      <div className={styles['unknown-board-port-helper-text']}>
        <Medium bold>{formatMessage(messages.identifyDeviceTitle)}</Medium>
        <XSmall className={styles['unknown-board-port-label']}>
          <UsbPort aria-hidden="true" focusable="false" />
          {`Port: ${unknownDeviceToIdentify.portName}`}
        </XSmall>
      </div>
    </div>
  ) : null;

  if (devicesAreLoading) {
    return (
      <DevicesMoreThanOne
        promptElement={unknownBoardPortHelper}
        devices={[]}
        deviceListModality={DevicesListModality.Loading}
        searchable={false}
        markAssociated={false}
        classes={{ header: styles.header, listHelper: styles['list-helper'] }}
      />
    );
  }

  return (
    <DevicesMoreThanOne
      promptElement={unknownBoardPortHelper}
      devices={devicesFiltered}
      deviceListModality={DevicesListModality.Undetected}
      searchable={true}
      markAssociated={false}
      classes={{ header: styles.header, listHelper: styles['list-helper'] }}
      onItemSelect={onItemSelect}
    />
  );
};

export default IdentifyUnknown;
