import { Terminal } from '@cloud-editor-mono/images/assets/icons';
import {
  ConsolePanelProps,
  SerialMonitor,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useMemo } from 'react';

import { messages } from './messages';
import styles from './multiple-console-panel.module.scss';
import {
  createAppLabConsolePanelLogic,
  useSendMessage,
} from './multipleConsolePanelUtils';
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
    onMessageSend,
    selectedBoard,
  } = multipleConsolePanelLogic();

  const placeholder = useSendMessage(selectedBoard);
  const { formatMessage } = useI18n();

  const codeMirrorParams = {
    lineSeparator: '\r',
    wrapLines: true,
  };

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
          <SerialMonitor
            key={`monitor-${tab}-${consoleSources[tab].id}`}
            classes={{
              wrapper: styles['serial-monitor-wrapper'],
              contents: {
                wrapper: clsx(styles['serial-monitor-contents-wrapper'], {
                  [styles['has-actions']]: tab === 'serial-monitor',
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
            hasActions={tab === 'serial-monitor'}
            serialMonitorLogic={createAppLabConsolePanelLogic(onMessageSend)}
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
