import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import { Button, ButtonAppearance, ButtonSize, ButtonVariant } from '../button';
import styles from './tabs.module.scss';

export type TabsLogic<T extends string> = () => {
  tabs: readonly T[];
  activeTab: T;
  setTab: React.Dispatch<React.SetStateAction<T>>;
};

interface TabsProps<T extends string> {
  tabs: readonly T[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  classes?: {
    container?: string;
    tab?: string;
  };
  size?: 'small' | 'default';
  withBackground?: boolean;
  tabDictionary?: (tab: T) => string;
}

const Tabs = <T extends string>(props: TabsProps<T>): React.ReactElement => {
  const {
    tabs,
    activeTab: externalActiveTab,
    onTabChange,
    classes,
    size = 'default',
    withBackground = false,
    tabDictionary,
  } = props;

  const [internalActiveTab, setInternalActiveTab] = useState<T | undefined>(
    tabs[0],
  );

  const activeTab =
    externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;

  useEffect(() => {
    if (externalActiveTab !== undefined) {
      setInternalActiveTab(externalActiveTab);
    }
  }, [externalActiveTab]);

  const handleTabChange = (tab: T): void => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div
      className={clsx(
        styles['container'],
        classes?.container,
        withBackground && styles['container-with-background'],
        {
          [styles['default']]: size === 'default',
          [styles['small']]: size === 'small',
        },
      )}
    >
      {tabs &&
        tabs.map((tab) => (
          <Button
            key={tab}
            onClick={(): void => handleTabChange(tab)}
            variant={
              activeTab === tab ? ButtonVariant.Primary : ButtonVariant.Tertiary
            }
            appearance={ButtonAppearance.LowContrast}
            size={size === 'small' ? ButtonSize.XXSmall : ButtonSize.XSmall}
            disableInteractive
            className={clsx(
              styles['tab'],
              {
                [styles['active']]: activeTab === tab,
              },
              classes?.tab,
            )}
          >
            {tabDictionary ? tabDictionary(tab) : tab}
          </Button>
        ))}
    </div>
  );
};

export default Tabs;
