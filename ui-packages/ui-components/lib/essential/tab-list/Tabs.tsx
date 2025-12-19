import { AriaTabListOptions } from '@react-aria/tabs';
import { TabListStateOptions } from '@react-stately/tabs';
import clsx from 'clsx';
import { useRef } from 'react';
import { AriaTabProps, useTabList } from 'react-aria';
import { useTabListState } from 'react-stately';

import { Tab } from './Tab';
import styles from './tab-list.module.scss';
import { TabPanel } from './TabPanel';

export interface TabsProps
  extends AriaTabListOptions<AriaTabProps>,
    TabListStateOptions<AriaTabProps> {
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

export function Tabs(props: TabsProps): JSX.Element {
  const { selectedKey, isTabListHidden, classes } = props;

  const state = useTabListState(props);
  const ref = useRef(null);
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <div className={clsx(styles['tabs'], classes?.tabs)}>
      <div
        {...tabListProps}
        ref={ref}
        className={clsx(styles['tab-list'], classes?.tabList, {
          [styles['hidden']]: isTabListHidden,
        })}
      >
        {[...state.collection].map((item) => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            isTabSelected={item.key === selectedKey}
            classes={{
              tab: classes?.tab,
              tabText: classes?.tabText,
              tabSelected: classes?.tabSelected,
            }}
          />
        ))}
      </div>
      <TabPanel
        key={state.selectedItem?.key}
        state={state}
        classes={{
          tabPanel: classes?.tabPanel,
        }}
      />
    </div>
  );
}
