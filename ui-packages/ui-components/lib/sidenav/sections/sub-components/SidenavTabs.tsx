import { Key } from 'react';
import { Item } from 'react-stately';

import { Tabs } from '../../../essential/tab-list/Tabs';
import { useI18n } from '../../../i18n/useI18n';
import {
  SidenavItemId,
  SidenavTabItem,
  SidenavTabsIds,
} from '../../sidenav.type';

interface SidenavTabsProps {
  type: SidenavItemId;
  defaultTab: SidenavTabsIds;
  tabs: SidenavTabItem[];
  selectedTab?: SidenavTabsIds;
  selectTab: (key: Key) => void;
  children: JSX.Element;
  isTabListHidden?: boolean;
  classes?: {
    tabs?: string;
    tabList?: string;
    tab?: string;
    tabText?: string;
    tabSelected?: string;
    tabPanel?: string;
  };
}

export function SidenavTabs(props: SidenavTabsProps): JSX.Element {
  const {
    type,
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
      aria-label={type}
      selectedKey={selectedTab}
      defaultSelectedKey={defaultTab}
      onSelectionChange={selectTab}
      keyboardActivation="manual"
      classes={classes}
      isTabListHidden={isTabListHidden}
    >
      {tabs.map((item: SidenavTabItem) => (
        <Item key={item.id} title={formatMessage(item.label)}>
          {children}
        </Item>
      ))}
    </Tabs>
  );
}

export default SidenavTabs;
