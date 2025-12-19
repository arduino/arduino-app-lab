import {
  AppLabToggleOff,
  AppLabToggleOn,
  CaretDown,
  Power,
  Spinner,
  StatusError,
  StatusSuccess,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  useI18n,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { DropdownMenuButton } from '../essential/dropdown-menu/DropdownMenuButton';
import { messages } from './messages';
import styles from './runtime-actions.module.scss';
import {
  AppLabAction,
  AppLabActionStatus,
  RuntimeActionsProps,
} from './runtimeActions.type';

const RuntimeActions = <T extends string>(
  props: RuntimeActionsProps<T>,
): React.ReactElement => {
  const {
    runtimeActionsLogic,
    setTab,
    runtimeDisable,
    size = 'default',
  } = props;
  const [open, setOpen] = useState(false);
  const { formatMessage } = useI18n();

  const {
    appId,
    appDefault,
    appName,
    appStatus,
    currentAction,
    currentActionStatus,
    setAsDefaultApp,
    runApp,
    stopApp,
    isBannerEnabled = true,
    showStop = true,
  } = runtimeActionsLogic();

  const stopHandler = (): void => {
    if (appId) {
      stopApp(appId, appStatus);
      setTab && setTab('console' as T);
    }
  };

  const runHandler = (): void => {
    if (appId) {
      runApp(appId);
      setTab && setTab('console' as T);
    }
  };

  const getStatusBanner = (params: {
    action: AppLabAction;
    actionStatus: AppLabActionStatus;
  }): JSX.Element => {
    const messageDictionary: Record<
      AppLabActionStatus,
      Record<AppLabAction, string>
    > = {
      [AppLabActionStatus.Idle]: {
        run: '',
        stop: '',
        logs: '',
      },
      [AppLabActionStatus.Pending]: {
        run: 'Running...',
        stop: 'Stopping...',
        logs: '',
      },
      [AppLabActionStatus.Succeeded]: {
        run: `Done ${appName}.yml`,
        stop: `Stopped ${appName}.yml`,
        logs: `Done ${appName}.yml`,
      },
      [AppLabActionStatus.Errored]: {
        run: `Failed ${appName}.yml`,
        stop: `Failed ${appName}.yml`,
        logs: '',
      },
    };

    const iconDictionary: Record<AppLabActionStatus, JSX.Element> = {
      [AppLabActionStatus.Idle]: <></>,
      [AppLabActionStatus.Pending]: <Spinner />,
      [AppLabActionStatus.Succeeded]: <StatusSuccess />,
      [AppLabActionStatus.Errored]: <StatusError />,
    };

    const { action, actionStatus } = params;
    const message = messageDictionary[actionStatus]?.[action] || '';
    const icon = iconDictionary[actionStatus] || <></>;

    return (
      <div
        className={clsx(styles['status-message'], styles[actionStatus], {
          [styles['hide-after-3s']]:
            actionStatus !== AppLabActionStatus.Pending,
        })}
      >
        {icon}
        <span>{message}</span>
      </div>
    );
  };

  const canAbortRun =
    currentActionStatus === AppLabActionStatus.Pending &&
    currentAction === AppLabAction.Run &&
    appStatus === 'stopped';

  const stopShown = showStop && (appStatus === 'running' || canAbortRun);
  const stopDisabled =
    currentActionStatus === AppLabActionStatus.Pending &&
    currentAction === AppLabAction.Stop;

  const BANNER_CLEAN_TIME = 3500; //Animation is on 3s lasting 500ms
  const [showStatusBanner, setShowStatusBanner] = useState<
    | {
        action: AppLabAction;
        actionStatus: AppLabActionStatus;
      }
    | undefined
  >();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    clearTimeout(timeoutRef.current || undefined);

    if (!currentAction || !isBannerEnabled)
      return setShowStatusBanner(undefined);

    setShowStatusBanner({
      action: currentAction,
      actionStatus: currentActionStatus,
    });

    if (currentActionStatus !== AppLabActionStatus.Pending) {
      timeoutRef.current = setTimeout(() => {
        setShowStatusBanner(undefined);
        timeoutRef.current = null;
      }, BANNER_CLEAN_TIME);
    }

    return () => clearTimeout(timeoutRef.current || undefined);
  }, [currentAction, currentActionStatus, isBannerEnabled]);

  return (
    <div className={styles['actions']}>
      {showStatusBanner && getStatusBanner(showStatusBanner)}
      <div
        className={clsx(styles['button-container'], {
          [styles['stop']]: stopShown,
          [styles['run']]: !stopShown,
        })}
      >
        {stopShown && (
          <Button
            classes={
              setAsDefaultApp && {
                button: styles['button'],
              }
            }
            onClick={stopHandler}
            type={ButtonType.Secondary}
            size={size === 'small' ? ButtonSize.XSmall : ButtonSize.Small}
            variant={ButtonVariant.Destructive}
            disabled={stopDisabled || runtimeDisable}
          >
            Stop
          </Button>
        )}
        {!stopShown && (
          <Button
            classes={
              setAsDefaultApp && {
                button: styles['button'],
              }
            }
            onClick={runHandler}
            type={ButtonType.Primary}
            size={size === 'small' ? ButtonSize.XSmall : ButtonSize.Small}
            variant={ButtonVariant.Action}
            disabled={
              currentActionStatus === AppLabActionStatus.Pending ||
              runtimeDisable
            }
          >
            Run
          </Button>
        )}
        {setAsDefaultApp && (
          <DropdownMenuButton
            sections={[
              {
                name: 'Actions',
                items: [
                  {
                    id: 'default',
                    node: (
                      <div className={styles['dropdown-menu-item']}>
                        <div className={styles['dropdown-menu-item-title']}>
                          <Power />
                          <XXSmall>
                            {formatMessage(messages.runAtStartup)}
                          </XXSmall>
                          {appDefault?.id === appId ? (
                            <AppLabToggleOn />
                          ) : (
                            <AppLabToggleOff />
                          )}
                        </div>
                        <XXXSmall
                          className={styles['dropdown-menu-item-content']}
                        >
                          {appDefault && appDefault.id !== appId
                            ? formatMessage(messages.overrideAsDefault, {
                                appName: (
                                  <span className={styles['app-name']}>
                                    {appDefault.name}
                                  </span>
                                ),
                                bold: (text: string) => <b>{text}</b>,
                              })
                            : formatMessage(messages.setAsDefault, {
                                bold: (text: string) => <b>{text}</b>,
                              })}
                        </XXXSmall>
                      </div>
                    ),
                    label: formatMessage(messages.runAtStartup),
                  },
                ],
              },
            ]}
            buttonChildren={<CaretDown />}
            useStaticPosition={false}
            onAction={(): void => setAsDefaultApp(appDefault?.id !== appId)}
            isOpen={open}
            onOpen={setOpen}
            classes={{
              dropdownMenu: styles['dropdown-menu'],
              dropdownMenuButton: styles['dropdown-menu-button'],
              dropdownMenuButtonWrapper: clsx(
                styles['dropdown-menu-button-wrapper'],
                {
                  [styles['open']]: open,
                },
              ),
              dropdownMenuItem: styles['dropdown-menu-item-container'],
              dropdownMenuList: styles['dropdown-menu-list'],
            }}
          />
        )}
      </div>
    </div>
  );
};

export default RuntimeActions;
