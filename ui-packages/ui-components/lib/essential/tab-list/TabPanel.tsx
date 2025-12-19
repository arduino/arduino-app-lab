import clsx from 'clsx';
import { useRef } from 'react';
import { AriaTabPanelProps, useTabPanel } from 'react-aria';
import { TabListState } from 'react-stately';

import styles from './tab-list.module.scss';

interface TabPanelProps extends AriaTabPanelProps {
  state: TabListState<object>;
  classes?: {
    tabPanel?: string;
  };
}

export function TabPanel(props: TabPanelProps): JSX.Element {
  const { state, classes } = props;

  const ref = useRef(null);
  const { tabPanelProps } = useTabPanel(props, state, ref);
  return (
    <div
      {...tabPanelProps}
      ref={ref}
      className={clsx(styles['tab-panel'], classes?.tabPanel)}
    >
      {state.selectedItem?.props.children}
    </div>
  );
}
