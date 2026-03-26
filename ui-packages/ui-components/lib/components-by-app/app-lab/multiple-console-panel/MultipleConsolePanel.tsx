import { Terminal } from '@cloud-editor-mono/images/assets/icons';
import {
  CONSOLE_SOURCE_KEYS,
  ConsolePanelProps,
  ProgressBar,
  SerialMonitor,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useMemo } from 'react';

import { codeMirrorParams } from './config';
import { useSendMessage } from './hooks/useSendMessage';
import { messages } from './messages';
import styles from './multiple-console-panel.module.scss';
import ConsoleTabs from './sub-components/ConsoleTabs';
import { getOrderedConsoleTabs } from './utils';

const MultipleConsolePanel: React.FC<ConsolePanelProps> = (
  props: ConsolePanelProps,
) => {
  const { multipleConsolePanelLogic } = props;

  const {
    showLogs,
    consoleTabs,
    consoleSources,
    activeTab,
    setActiveTab,
    resetSource,
    selectedBoard,
    serialMonitorLogic,
    isAppStarting,
  } = multipleConsolePanelLogic();

  const placeholder = useSendMessage(selectedBoard);
  const { formatMessage } = useI18n();

  const orderedConsoleTabs = useMemo(
    () => getOrderedConsoleTabs(consoleTabs),
    [consoleTabs],
  );

  return orderedConsoleTabs.length === 0 || !showLogs ? (
    <div className={styles['empty-apps']}>
      <div className={styles['empty-apps-icon']}>
        <Terminal />
      </div>
      <span>{formatMessage(messages.description)}</span>
    </div>
  ) : (
    <div className={styles['console-panel']}>
      <ConsoleTabs
        consoleTabs={orderedConsoleTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {orderedConsoleTabs.map((tab) => (
        <div
          className={clsx(styles['console-panel-monitor'], {
            [styles['hidden']]: activeTab !== tab,
          })}
          key={tab}
        >
          <ProgressBar
            classes={{ progressBar: styles['progress-bar'] }}
            active={isAppStarting}
          />
          <SerialMonitor
            key={`monitor-${tab}-${consoleSources[tab].id}`}
            classes={{
              wrapper: styles['serial-monitor-wrapper'],
              contents: {
                wrapper: clsx(styles['serial-monitor-contents-wrapper'], {
                  [styles['has-actions']]:
                    tab === CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
                }),
              },
              actions: {
                wrapper: styles['serial-monitor-actions-wrapper'],
                selector: {
                  wrapper: styles['serial-monitor-actions-selector'],
                  menu: styles['serial-monitor-actions-selector-menu'],
                },
                input: {
                  input: styles['serial-monitor-actions-input'],
                  button: styles['serial-monitor-actions-input-button'],
                },
              },
            }}
            sendMessagePlaceholder={placeholder}
            hasToolbar={false}
            hasActions={tab === CONSOLE_SOURCE_KEYS.SERIAL_MONITOR}
            serialMonitorLogic={serialMonitorLogic}
            resetSource={resetSource}
            logSource={consoleSources[tab].subject}
            codeMirrorParams={codeMirrorParams}
          />
        </div>
      ))}
    </div>
  );
};

export default MultipleConsolePanel;
