import {
  Bricks,
  Python,
  Rocket,
  SketchParentheses,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from './console-tabs.module.scss';

interface ConsoleTabProps {
  consoleTabs: string[];
  activeTab: string | undefined;
  setActiveTab: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const ConsoleTabs: React.FC<ConsoleTabProps> = (props: ConsoleTabProps) => {
  const { consoleTabs, activeTab, setActiveTab } = props;

  const renderTabIcon = (tab: string): JSX.Element => {
    switch (tab) {
      case 'startup':
        return <Rocket />;
      case 'main':
        return <Python />;
      case 'serial-monitor':
        return <SketchParentheses />;
      default:
        return <Bricks />;
    }
  };

  const tabDictionary = (tab: string): string => {
    switch (tab) {
      case 'startup':
        return 'App launch';
      case 'main':
        return 'Python';
      case 'serial-monitor':
        return 'Serial Monitor';
      default:
        return tab;
    }
  };

  const bgColor = (tab: string): string => {
    switch (tab) {
      case 'startup':
        return 'rgba(193, 171, 21, 0.20)';
      case 'main':
        return 'rgba(21, 173, 223, 0.20)';
      case 'serial-monitor':
        return 'rgba(37, 194, 199, 0.20)';
      default:
        return 'rgba(196, 196, 196, 0.20)';
    }
  };

  return (
    <div className={styles['container']}>
      {consoleTabs.map((tab) => (
        <button
          className={clsx(
            styles['tab'],
            activeTab === tab ? styles['active'] : '',
          )}
          key={tab}
          onClick={(): void => setActiveTab(tab)}
        >
          <div
            className={styles['tab-icon']}
            style={{ backgroundColor: bgColor(tab) }}
          >
            {renderTabIcon(tab)}
          </div>
          {tabDictionary(tab)}
        </button>
      ))}
    </div>
  );
};

export default ConsoleTabs;
