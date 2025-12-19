import type { Node } from '@react-types/shared';
import clsx from 'clsx';
import { useRef } from 'react';
import { AriaTabProps, useTab } from 'react-aria';
import { TabListState } from 'react-stately';

import { XXSmall } from '../../typography';
import styles from './tab-list.module.scss';

interface TabProps extends AriaTabProps {
  item: Node<object>;
  state: TabListState<object>;
  isTabSelected?: boolean;
  classes?: {
    tab?: string;
    tabText?: string;
    tabSelected?: string;
  };
}

export function Tab(props: TabProps): JSX.Element {
  const { item, state, isTabSelected, classes } = props;

  const { key, rendered } = item;
  const ref = useRef(null);
  const { tabProps } = useTab({ key }, state, ref);

  return (
    <div
      {...tabProps}
      ref={ref}
      className={clsx(
        styles['tab'],
        classes?.tab,
        isTabSelected && [styles['tab-selected'], classes?.tabSelected],
      )}
    >
      <XXSmall
        bold={isTabSelected}
        className={clsx(styles['tab-text'], classes?.tabText)}
      >
        {rendered}
      </XXSmall>
    </div>
  );
}
