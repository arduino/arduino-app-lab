import { FC, Key } from 'react';
import { Item } from 'react-stately';

import { Tabs, TabsProps } from '../../../../essential/tab-list/Tabs';
import { useI18n } from '../../../../i18n/useI18n';
import styles from './devices-tabs.module.scss';
import {
  DetectedDevicesGroup,
  DetectedDevicesGroupItem,
} from './devicesTabs.type';

interface DevicesTabsProps {
  defaultTab: DetectedDevicesGroup;
  tabs: DetectedDevicesGroupItem[];
  selectedTab?: DetectedDevicesGroup;
  selectTab: (key: Key) => void;
  children: JSX.Element;
  isTabListHidden?: boolean;
  classes?: TabsProps['classes'];
}

export const DevicesTabs: FC<DevicesTabsProps> = (props: DevicesTabsProps) => {
  const {
    defaultTab,
    tabs,
    selectedTab,
    selectTab,
    children,
    isTabListHidden,
    classes,
  } = props;

  const { formatMessage } = useI18n();

  return (
    <Tabs
      aria-label={'detectedDevices'}
      selectedKey={selectedTab}
      defaultSelectedKey={defaultTab}
      onSelectionChange={selectTab}
      keyboardActivation="manual"
      classes={{
        tabs: styles.tabs,
        tabList: styles['tab-list'],
        tabPanel: styles.panel,
        ...classes,
      }}
      isTabListHidden={isTabListHidden}
    >
      {tabs.map((item: DetectedDevicesGroupItem) => (
        <Item key={item.id} title={formatMessage(item.label)}>
          {children}
        </Item>
      ))}
    </Tabs>
  );
};

export default DevicesTabs;
