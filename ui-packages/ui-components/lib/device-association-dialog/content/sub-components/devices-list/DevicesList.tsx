import { ArrayElement } from '@cloud-editor-mono/common';
import { NoResults } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { orderBy } from 'lodash';
import React, { forwardRef, useCallback } from 'react';

import {
  Flavor as SearchFlavor,
  SearchField,
} from '../../../../essential/search-field';
import useDebouncedSearch from '../../../../essential/search-field/useDebouncedSearch';
import { useI18n } from '../../../../i18n/useI18n';
import {
  DetectedDevices,
  Devices,
} from '../../../deviceAssociationDialog.type';
import { messages } from '../../messages';
import {
  DeviceListTypeMap,
  DevicesListModality,
} from '../../steps/templates/devicesMoreThanOne.type';
import DialogImage from '../device-image/DeviceImage';
import DialogContentHeader from '../dialog-content-header/DialogContentHeader';
import DeviceListItem from './device-list-item/DeviceListItem';
import { MIN_QUERY_LENGTH } from './deviceListUtils';
import styles from './devices-list.module.scss';
import { filterDeviceList } from './devicesListUtils';

export type DevicesListBaseProps = {
  [K in DevicesListModality]: {
    deviceListModality: K;
    searchable?: boolean;
    onListFiltered?: () => void;
    markAssociated?: boolean;
    usingWebSerial?: boolean;
    children?: React.ReactNode;
    classes?: { root?: string; container?: string; searchBar?: string };
  } & Omit<DeviceListTypeMap[K], 'onManualSelectChosen'>;
};

type DevicesListProps = DevicesListBaseProps[keyof DeviceListTypeMap];

const DevicesList = forwardRef(
  (props: DevicesListProps, searchRef: React.ForwardedRef<HTMLDivElement>) => {
    const {
      deviceListModality,
      searchable,
      onListFiltered,
      devices,
      children,
      classes,
      markAssociated = true,
      usingWebSerial = false,
    } = props;
    const { formatMessage } = useI18n();

    const filterItems = useCallback(
      (
        items: ArrayElement<typeof devices>[],
        query: string,
      ): ArrayElement<typeof devices>[] => {
        if (query && query.length >= MIN_QUERY_LENGTH) {
          const filteredDevices = filterDeviceList(query, items);

          onListFiltered && onListFiltered();
          return filteredDevices;
        }

        return items;
      },
      [onListFiltered],
    );

    const { query, setQuery, filteredItems } = useDebouncedSearch<
      ArrayElement<typeof devices>
    >(devices, filterItems);

    const items = ((): React.ReactNode => {
      if (
        deviceListModality !== DevicesListModality.Loading &&
        filteredItems.length === 0
      )
        return (
          <div className={styles['no-results-container']}>
            <DialogImage
              Icon={<NoResults />}
              classes={{ container: styles['no-results-image'] }}
            />
            <DialogContentHeader
              title={formatMessage(messages.noResultsTitle)}
              subtitle={formatMessage(messages.noResultsSubtitle)}
              classes={{
                title: styles['no-results-title'],
                subtitle: styles['no-results-subtitle'],
              }}
            />
          </div>
        );

      if (deviceListModality === DevicesListModality.Detected) {
        return (filteredItems as DetectedDevices)
          ?.map((device) => {
            const {
              portBoardId,
              fqbn,
              name,
              architecture,
              portName,
              isUnknownBoard,
              isAssociated,
              isIot,
              webSerialSupport,
            } = device;
            return (
              <DeviceListItem
                deviceListModality={deviceListModality}
                key={portBoardId}
                fqbn={fqbn}
                name={name}
                architecture={architecture}
                isAssociated={markAssociated && isAssociated}
                onItemSelect={props.onItemSelect}
                id={portBoardId}
                portName={portName}
                isUnknownBoard={isUnknownBoard}
                isIot={isIot}
                webSerialSupport={webSerialSupport}
                usingWebSerial={usingWebSerial}
              />
            );
          })
          .reverse();
      }

      if (deviceListModality === DevicesListModality.Undetected) {
        return orderBy(
          filteredItems as Devices,
          ['isAssociated'],
          ['desc'],
        ).map((device) => {
          const {
            id,
            fqbn,
            name,
            architecture,
            isAssociated,
            webSerialSupport,
          } = device;
          return (
            <DeviceListItem
              deviceListModality={deviceListModality}
              key={id}
              fqbn={fqbn}
              name={name}
              architecture={architecture}
              isAssociated={markAssociated && isAssociated}
              onItemSelect={props.onItemSelect}
              webSerialSupport={webSerialSupport}
              usingWebSerial={usingWebSerial}
            />
          );
        });
      }

      if (deviceListModality === DevicesListModality.Loading) {
        return Array.from(Array(10).keys()).map((index) => (
          <DeviceListItem deviceListModality={deviceListModality} key={index} />
        ));
      }
    })();

    const renderSearchField = (): JSX.Element => (
      <SearchField
        ref={searchRef}
        placeholder={formatMessage(messages.searchBarPlaceholder)}
        value={query}
        onChange={setQuery}
        flavor={SearchFlavor.Rounded}
        classes={{
          container: clsx(classes?.searchBar),
        }}
      />
    );

    return (
      <div className={clsx(styles.root, classes?.root)}>
        {searchable ? renderSearchField() : null}
        <div
          className={clsx(styles.container, classes?.container, {
            [styles['undetected-container']]:
              deviceListModality === DevicesListModality.Undetected,
          })}
        >
          <div
            className={clsx({
              [styles['items-container']]:
                deviceListModality === DevicesListModality.Detected,
            })}
          >
            {items}
          </div>
          {filteredItems.length > 0 ? children || null : null}
        </div>
      </div>
    );
  },
);

DevicesList.displayName = 'DevicesList';

export default DevicesList;
