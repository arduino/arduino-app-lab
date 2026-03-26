import {
  Bricks,
  Python,
  Rocket,
  SketchParentheses,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import {
  CONSOLE_SOURCE_KEYS,
  ConsoleSourceKey,
} from '../multipleConsolePanel.type';
import styles from './console-tabs.module.scss';

interface ConsoleTabProps {
  consoleTabs: ConsoleSourceKey[];
  activeTab: ConsoleSourceKey | undefined;
  setActiveTab: React.Dispatch<
    React.SetStateAction<ConsoleSourceKey | undefined>
  >;
}

const ConsoleTabs: React.FC<ConsoleTabProps> = (props: ConsoleTabProps) => {
  const { consoleTabs, activeTab, setActiveTab } = props;

  const renderTabIcon = (tab: ConsoleSourceKey): JSX.Element => {
    switch (tab) {
      case CONSOLE_SOURCE_KEYS.STARTUP:
        return <Rocket />;
      case CONSOLE_SOURCE_KEYS.PYTHON:
        return <Python />;
      case CONSOLE_SOURCE_KEYS.SERIAL_MONITOR:
        return <SketchParentheses />;
      default:
        return <Bricks />;
    }
  };

  const tabDictionary = (tab: ConsoleSourceKey): string => {
    switch (tab) {
      case CONSOLE_SOURCE_KEYS.STARTUP:
        return 'App launch';
      case CONSOLE_SOURCE_KEYS.PYTHON:
        return 'Python';
      case CONSOLE_SOURCE_KEYS.SERIAL_MONITOR:
        return 'Serial Monitor';
      default:
        return tab;
    }
  };

  const bgColor = (tab: ConsoleSourceKey): string => {
    switch (tab) {
      case CONSOLE_SOURCE_KEYS.STARTUP:
        return 'rgba(193, 171, 21, 0.20)';
      case CONSOLE_SOURCE_KEYS.PYTHON:
        return 'rgba(21, 173, 223, 0.20)';
      case CONSOLE_SOURCE_KEYS.SERIAL_MONITOR:
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
