import {
  ChevronUp,
  Clear,
  CloseX,
  NavigationArrow,
  NavigationChevron,
  StopWatch,
  StopWatchDisable,
  Terminal,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  CONSOLE_SOURCE_KEYS,
  ConsolePanelProps,
  IconButton,
  ProgressBar,
  SerialMonitor,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { codeMirrorParams } from './config';
import { useSendMessage } from './hooks/useSendMessage';
import { messages } from './messages';
import styles from './multiple-console-panel.module.scss';
import ConsoleTabs from './sub-components/ConsoleTabs';
import { getOrderedConsoleTabs } from './utils';

const MultipleConsolePanel: React.FC<ConsolePanelProps> = (
  props: ConsolePanelProps,
) => {
  const { formatMessage } = useI18n();
  const {
    multipleConsolePanelLogic,
    isCollapsed = true,
    toggleCollapse,
    isMaximized,
    onMaximize,
    onMinimize,
  } = props;

  const {
    //showLogs,
    consoleTabs,
    consoleSources,
    activeTab,
    setActiveTab,
    selectedBoard,
    serialMonitorLogic,
    isAppStarting,
    isAppStopping,
  } = multipleConsolePanelLogic();

  const [autoscrollStates, setAutoscrollStates] = useState<
    Record<string, boolean>
  >({});
  const [timestampStates, setTimestampStates] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if ((isAppStarting || isAppStopping) && isCollapsed) {
      toggleCollapse?.();
    }
  }, [isAppStarting, isAppStopping, isCollapsed, toggleCollapse]);

  const placeholder = useSendMessage(selectedBoard);

  const orderedConsoleTabs = useMemo(
    () => getOrderedConsoleTabs(consoleTabs),
    [consoleTabs],
  );

  const disabledControls = orderedConsoleTabs.length === 0;

  const handleToggleAutoscroll = useCallback((): void => {
    if (activeTab) {
      setAutoscrollStates((prev) => ({
        ...prev,
        [activeTab]: !(prev[activeTab] ?? true),
      }));
    }
  }, [activeTab]);

  const handleAutoScrollChanged = useCallback(
    (tab: string, enabled: boolean): void => {
      setAutoscrollStates((prev) => ({
        ...prev,
        [tab]: enabled,
      }));
    },
    [],
  );

  const handleToggleTimestamps = useCallback((): void => {
    if (activeTab) {
      setTimestampStates((prev) => ({
        ...prev,
        [activeTab]: !(prev[activeTab] ?? false),
      }));
    }
  }, [activeTab]);

  const handleTimestampsChanged = useCallback(
    (tab: string, enabled: boolean): void => {
      setTimestampStates((prev) => ({
        ...prev,
        [tab]: enabled,
      }));
    },
    [],
  );

  const autoscrollActive = (activeTab && autoscrollStates[activeTab]) ?? true;

  const timestampsActive = (activeTab && timestampStates[activeTab]) ?? false;

  return (
    <>
      {isCollapsed ? (
        <div className={styles['empty-console']}>
          <div className={styles['empty-console--left']}>
            <Button
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              Icon={NavigationArrow}
              onClick={(): void => toggleCollapse?.()}
            >
              {formatMessage(messages.openConsole)}
            </Button>
          </div>
          <div className={styles['empty-console--right']}>
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              label={formatMessage(messages.openConsole)}
              Icon={ChevronUp}
              onClick={(): void => toggleCollapse?.()}
            />
          </div>
        </div>
      ) : null}
      <div
        className={clsx(styles['console-panel'], {
          [styles['hidden']]: isCollapsed,
        })}
      >
        <div className={styles['console-panel-header']}>
          <ConsoleTabs
            consoleTabs={orderedConsoleTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <div className={styles['console-panel-header--actions']}>
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              label={formatMessage(
                autoscrollActive
                  ? messages.disableAutoscroll
                  : messages.enableAutoscroll,
              )}
              Icon={NavigationChevron}
              disabled={disabledControls}
              onClick={handleToggleAutoscroll}
            />
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              onClick={handleToggleTimestamps}
              label={formatMessage(
                timestampsActive
                  ? messages.hideTimestamp
                  : messages.showTimestamp,
              )}
              Icon={timestampsActive ? StopWatchDisable : StopWatch}
              disabled={disabledControls}
            />
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              onClick={(): void => {
                if (activeTab && consoleSources[activeTab]?.resetSubject) {
                  consoleSources[activeTab].resetSubject?.next();
                }
              }}
              label={formatMessage(messages.clearLog)}
              Icon={Clear}
              disabled={disabledControls}
            />
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              label={formatMessage(
                isMaximized ? messages.minimize : messages.maximize,
              )}
              classes={{
                icon: clsx({
                  [styles['console-panel-header--actions-maximized']]:
                    isMaximized,
                }),
              }}
              Icon={ChevronUp}
              onClick={isMaximized ? onMinimize : onMaximize}
            />
            <IconButton
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.LowContrast}
              label={formatMessage(messages.close)}
              Icon={CloseX}
              onClick={(): void => toggleCollapse?.()}
            />
          </div>
        </div>
        <div className={styles['console-panel-monitor']}>
          <ProgressBar
            classes={{ progressBar: styles['progress-bar'] }}
            active={isAppStarting || isAppStopping}
          />
          {orderedConsoleTabs.length === 0 ? (
            <div className={styles['console-panel-monitor--empty']}>
              <div>
                <Terminal />
              </div>
              <span>{formatMessage(messages.runAppToGenerate)}</span>
            </div>
          ) : (
            orderedConsoleTabs.map((tab) => (
              <SerialMonitor
                key={`monitor-${tab}-${consoleSources[tab].id}`}
                classes={{
                  wrapper: clsx(styles['serial-monitor-wrapper'], {
                    [styles['hidden']]: activeTab !== tab,
                  }),
                  contents: {
                    content: clsx(
                      styles['serial-monitor-contents-content'],
                      consoleSources[tab].style
                        ? styles[
                            `serial-monitor-contents-content--${consoleSources[tab].style}`
                          ]
                        : null,
                    ),
                    wrapper: clsx(styles['serial-monitor-contents-wrapper'], {
                      [styles['has-actions']]:
                        tab === CONSOLE_SOURCE_KEYS.SERIAL_MONITOR,
                    }),
                    viewNewDataButton:
                      styles['serial-monitor-scroll-down-app-lab'],
                  },
                  actions: {
                    wrapper: styles['serial-monitor-actions-wrapper'],
                    selector: {
                      wrapper: styles['serial-monitor-actions-selector'],
                      menu: styles['serial-monitor-actions-selector-menu'],
                      menuPopover:
                        styles['serial-monitor-actions-selector-menu-popover'],
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
                resetSource={consoleSources[tab].resetSubject}
                logSource={consoleSources[tab].subject}
                codeMirrorParams={codeMirrorParams}
                autoScrollEnabled={autoscrollStates[tab] ?? true}
                onAutoScrollChanged={(enabled): void =>
                  handleAutoScrollChanged(tab, enabled)
                }
                timestampsActive={timestampStates[tab] ?? false}
                onTimestampsChanged={(enabled): void =>
                  handleTimestampsChanged(tab, enabled)
                }
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default MultipleConsolePanel;
