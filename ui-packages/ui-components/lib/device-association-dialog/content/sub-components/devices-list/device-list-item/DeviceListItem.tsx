import { DeviceImage } from '@cloud-editor-mono/images/assets/devices';
import {
  CloudPortIcon,
  SelectedDeviceTick,
  Unlink,
  UsbPort,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { uniqueId } from 'lodash';
import { useContext, useRef, useState } from 'react';

import { Button } from '../../../../../essential/button/Button';
import { ButtonType } from '../../../../../essential/button/button.type';
import { useI18n } from '../../../../../i18n/useI18n';
import { Skeleton } from '../../../../../skeleton';
import { TextSize, XSmall, XXSmall } from '../../../../../typography';
import { DeviceAssociationContext } from '../../../../context/deviceAssociationContext';
import { UNKNOWN_BOARD_FQBN, UNKNOWN_BOARD_NAME } from '../../../../utils';
import { messages } from '../../../messages';
import {
  DeviceListItemTypeMap,
  DeviceListTypeMap,
  DevicesListModality,
} from '../../../steps/templates/devicesMoreThanOne.type';
import DialogImage from '../../device-image/DeviceImage';
import { DialogImageTypes } from '../../device-image/deviceImage.type';
import { DetectedDevicesGroup } from '../../devices-tabs/devicesTabs.type';
import styles from './device-list-item.module.scss';
interface DefaultProps<T extends DevicesListModality | null> {
  deviceListModality: T;
  fqbn?: string;
  name?: string;
  architecture?: string;
  isAssociated?: boolean;
  isIot?: boolean;
  usingWebSerial?: boolean;
  webSerialSupport?: boolean;
}

export type DeviceListItemBaseProps = {
  [K in DevicesListModality]: DefaultProps<K> & DeviceListItemTypeMap[K];
};

type DeviceListItemProps =
  | DeviceListItemBaseProps[keyof DeviceListTypeMap]
  | DefaultProps<null>;

const DeviceListItem: React.FC<DeviceListItemProps> = (
  props: DeviceListItemProps,
) => {
  const {
    deviceListModality,
    fqbn,
    name,
    architecture,
    isAssociated,
    isIot,
    usingWebSerial,
    webSerialSupport,
  } = props;
  const { selectedTab } = useContext(DeviceAssociationContext);

  const { formatMessage } = useI18n();

  const detachButtonId = uniqueId();
  const [itemIsFocused, setItemIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const detachButtonRef = useRef<HTMLButtonElement>(null);

  const detachEvent =
    deviceListModality === DevicesListModality.Detected
      ? (event: React.MouseEvent<HTMLElement>): void => {
          event.stopPropagation();
          props.onItemSelect('');
        }
      : deviceListModality === DevicesListModality.Undetected
      ? (event: React.MouseEvent<HTMLElement>): void => {
          event.stopPropagation();
          props.onItemSelect('', '', '');
        }
      : undefined;

  const onClick =
    deviceListModality === DevicesListModality.Detected
      ? (): void => {
          props.onItemSelect(
            props.id,
            props.portName,
            props.isUnknownBoard,
            isIot,
          );
        }
      : deviceListModality === DevicesListModality.Undetected
      ? (): void => {
          fqbn &&
            name &&
            architecture &&
            props.onItemSelect(fqbn, name, architecture);
        }
      : undefined;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key == 'Tab' && isAssociated) {
      event.preventDefault();

      if (detachButtonRef.current) {
        const detachButtonIsFocused =
          document.activeElement?.id === detachButtonRef.current.id;

        if (detachButtonIsFocused) {
          setItemIsFocused(false);

          if (containerRef.current) {
            const { nextElementSibling } = containerRef.current;
            if (nextElementSibling)
              (nextElementSibling as HTMLElement)?.focus();
          }

          return;
        }

        setItemIsFocused(true);
        detachButtonRef.current.focus();
      }
    }
  };

  const onKeyUp = onClick
    ? (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key == 'Enter') {
          onClick();
        }
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={clsx(styles.container, {
        [styles['container-detected']]:
          deviceListModality === DevicesListModality.Detected,
        [styles['container-undetected-device']]:
          deviceListModality === DevicesListModality.Undetected,
        [styles['container-loading-device']]:
          deviceListModality === DevicesListModality.Loading,
        [styles['no-pointer']]: deviceListModality === null,
      })}
      onClick={!isAssociated ? onClick : undefined}
      role="button"
      tabIndex={0}
      onFocus={
        isAssociated
          ? (): void => {
              setItemIsFocused(true);
            }
          : undefined
      }
      onBlur={
        isAssociated
          ? (): void => {
              setItemIsFocused(false);
            }
          : undefined
      }
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      {deviceListModality === DevicesListModality.Detected ||
      deviceListModality === null ? (
        <DialogImage
          Icon={
            deviceListModality !== null ? (
              <DeviceImage deviceImageKey={fqbn || UNKNOWN_BOARD_FQBN} />
            ) : (
              <div className={styles['device-image-skeleton']}>
                <Skeleton variant="rect" count={1} />
              </div>
            )
          }
          type={
            isIot && selectedTab === DetectedDevicesGroup.Offline
              ? DialogImageTypes.DeviceSmall
              : DialogImageTypes.DeviceMedium
          }
          classes={{ container: styles.image }}
        />
      ) : null}
      <div className={styles['device-info-container']}>
        {deviceListModality !== null &&
        deviceListModality !== DevicesListModality.Loading ? (
          <XSmall
            className={styles['device-name']}
            bold={deviceListModality === DevicesListModality.Detected}
          >
            {name || UNKNOWN_BOARD_NAME}
          </XSmall>
        ) : (
          <div className={styles['device-name-skeleton']}>
            <Skeleton variant="rect" count={1} />
          </div>
        )}
        {(deviceListModality === DevicesListModality.Detected &&
          (!isIot || (isIot && selectedTab === DetectedDevicesGroup.Online))) ||
        deviceListModality === null ? (
          <XXSmall className={styles['port-label']}>
            {!isIot ? (
              <UsbPort aria-hidden="true" focusable="false" />
            ) : (
              <CloudPortIcon aria-hidden="true" focusable="false" />
            )}
            {deviceListModality === DevicesListModality.Detected ? (
              !isIot ? (
                `Port: ${props.portName}`
              ) : (
                formatMessage(messages.overTheAirDeviceLabel)
              )
            ) : (
              <div className={styles['ellipsis-placeholder']}></div>
            )}
          </XXSmall>
        ) : null}
      </div>
      {isAssociated ? (
        <div className={styles['associated-detach-container']} tabIndex={-1}>
          <SelectedDeviceTick
            className={clsx(
              styles['selected-tick'],
              styles['selected-tick-hidden'],
              { [styles['hidden']]: itemIsFocused },
            )}
          />
          <Button
            id={detachButtonId}
            ref={detachButtonRef}
            type={ButtonType.Tertiary}
            Icon={Unlink}
            onClick={detachEvent}
            size={TextSize.XSmall}
            classes={{
              button: clsx(
                styles['detach-button'],
                styles['detach-button-show'],
                { [styles['shown-display-flex']]: itemIsFocused },
              ),
            }}
          >
            {formatMessage(messages.detachButton)}
          </Button>
        </div>
      ) : null}
      {usingWebSerial && !webSerialSupport && (
        <XSmall
          className={styles['device-verify-only']}
          title={formatMessage(messages.uploadNotSupported)}
        >
          {formatMessage(messages.verifyOnly)}
        </XSmall>
      )}
    </div>
  );
};

export default DeviceListItem;
