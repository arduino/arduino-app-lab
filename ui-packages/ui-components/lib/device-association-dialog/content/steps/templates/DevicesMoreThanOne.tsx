import clsx from 'clsx';
import { useCallback, useContext, useRef } from 'react';
import { useIntersection } from 'react-use';

import { useI18n } from '../../../../i18n/useI18n';
import { XSmall } from '../../../../typography';
import { DeviceAssociationContext } from '../../../context/deviceAssociationContext';
import { DeviceAssociationDialogLinks } from '../../../deviceAssociationDialog.type';
import { messages as messages } from '../../messages';
import DevicesList, {
  DevicesListBaseProps,
} from '../../sub-components/devices-list/DevicesList';
import DialogContentHeader from '../../sub-components/dialog-content-header/DialogContentHeader';
import LabeledDivider from '../../sub-components/labeled-divider/LabeledDivider';
import ManualSelectBlock from '../../sub-components/manual-select-block/ManualSelectBlock';
import TroubleShootingMessage from '../../sub-components/trouble-shooting-message/troubleShootingMessage';
import styles from './devices-more-than-one.module.scss';
import {
  DeviceListTypeMap,
  DevicesListModality,
} from './devicesMoreThanOne.type';

export type DevicesMoreThanOneBaseProps = {
  [K in keyof DevicesListBaseProps]: {
    deviceListModality: K;
    searchable?: boolean;
    promptElement?: JSX.Element | null;
    title?: string;
    listHelper?: string;
    markAssociated?: boolean;
    usingWebSerial?: boolean;
    classes?: {
      header?: string;
      listHelper?: string;
    };
  } & DeviceListTypeMap[K];
};

type DevicesMoreThanOneProps =
  DevicesMoreThanOneBaseProps[keyof DeviceListTypeMap];

const DevicesMoreThanOne: React.FC<DevicesMoreThanOneProps> = (
  props: DevicesMoreThanOneProps,
) => {
  const {
    devices,
    deviceListModality,
    searchable,
    promptElement = null,
    title,
    listHelper: listHelperString,
    markAssociated = true,
    usingWebSerial = false,
    classes,
  } = props;

  const { links, uploadPromptData, tabsAreVisible } = useContext(
    DeviceAssociationContext,
  );
  const { formatMessage } = useI18n();

  const scrollRef = useRef<HTMLDivElement>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const searchBarIntersection = useIntersection(searchRef, {
    root: scrollRef.current,
    threshold: 1,
  });

  const footerIntersection = useIntersection(footerRef, {
    root: scrollRef.current,
    threshold: 1,
  });

  const searchBarIsPinned =
    searchBarIntersection && searchBarIntersection.intersectionRatio < 1;

  const footerIsPinned =
    footerIntersection && footerIntersection.intersectionRatio < 1;

  const onDeviceListFiltered = useCallback((): void => {
    if (scrollRef.current) scrollRef.current.scrollTo(0, 0);
  }, []);

  const devicesListClasses = {
    root: clsx({
      [styles['devices-list-root-flex-one']]: searchable,
    }),
    container: clsx({
      [styles['devices-list-container-flex-one']]: searchable,
      [styles['devices-list-pinned-search-bar']]: searchBarIsPinned,
    }),
    searchBar: clsx(styles['search-bar'], {
      [styles['search-bar-pinned']]: searchBarIsPinned,
    }),
  };

  return (
    <div
      className={clsx(styles.body, {
        [styles['body-undetected']]:
          deviceListModality === DevicesListModality.Undetected,
      })}
      ref={scrollRef}
    >
      {promptElement}
      {title ? (
        <DialogContentHeader
          title={title}
          classes={{
            header: classes?.header,
            container: styles['header-container'],
          }}
        />
      ) : null}
      <div
        className={clsx(styles['devices-content'], {
          [styles['devices-content-flex-one']]: searchable,
          [styles['devices-content-in-tab']]: tabsAreVisible,
        })}
      >
        {listHelperString && !uploadPromptData ? (
          <XSmall
            className={clsx(styles['info-span-padding'], classes?.listHelper)}
          >
            {listHelperString}
          </XSmall>
        ) : null}
        {deviceListModality === DevicesListModality.Detected && (
          <DevicesList
            ref={searchRef}
            searchable={searchable}
            onListFiltered={onDeviceListFiltered}
            devices={
              !uploadPromptData
                ? devices
                : devices.filter((d) => d.fqbn === uploadPromptData.fqbn)
            }
            deviceListModality={deviceListModality}
            markAssociated={markAssociated}
            onItemSelect={props.onItemSelect}
            classes={devicesListClasses}
            usingWebSerial={usingWebSerial}
          >
            {!uploadPromptData ? (
              <>
                <TroubleShootingMessage
                  troubleShootingUrl={
                    links[DeviceAssociationDialogLinks.TroubleShootingDevices]
                  }
                  classes={{
                    span: clsx(styles['linked-message'], {
                      [styles['linked-message-flex-one']]: searchable,
                    }),
                  }}
                />
                <LabeledDivider
                  label={formatMessage(messages.dividerLabel)}
                  classes={{ container: styles['labeled-divider'] }}
                />
              </>
            ) : null}
          </DevicesList>
        )}
        {deviceListModality === DevicesListModality.Undetected && (
          <DevicesList
            ref={searchRef}
            searchable={searchable}
            onListFiltered={onDeviceListFiltered}
            devices={devices}
            deviceListModality={deviceListModality}
            markAssociated={markAssociated}
            onItemSelect={props.onItemSelect}
            classes={devicesListClasses}
            usingWebSerial={usingWebSerial}
          />
        )}
        {deviceListModality === DevicesListModality.Loading && (
          <DevicesList
            devices={[]}
            deviceListModality={deviceListModality}
            classes={devicesListClasses}
          />
        )}
      </div>
      {deviceListModality === DevicesListModality.Detected &&
      !uploadPromptData ? (
        <div
          className={clsx(styles['footer-container'], {
            [styles['footer-container-pinned']]: footerIsPinned,
          })}
          ref={footerRef}
        >
          <ManualSelectBlock onClick={props.onManualSelectChosen} />
        </div>
      ) : null}
      <div className={styles['bottom-pad']}></div>
    </div>
  );
};

export default DevicesMoreThanOne;
