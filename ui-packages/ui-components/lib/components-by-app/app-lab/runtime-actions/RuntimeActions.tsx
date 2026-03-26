import {
  AppLabToggleOff,
  AppLabToggleOn,
  CaretDown,
  Play,
  Power,
  Spinner,
  StatusError,
  StatusSuccess,
  Stop,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Action,
  ActionStatus,
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  DropdownMenuButton,
  RuntimeActionsProps,
  useI18n,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { messages } from './messages';
import styles from './runtime-actions.module.scss';

const RuntimeActions = (props: RuntimeActionsProps): React.ReactElement => {
  const { runtimeActionsLogic, runtimeDisable } = props;
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
    openApp,
    runApp,
    stopApp,
    isBannerEnabled = true,
    showStop = true,
  } = runtimeActionsLogic();

  const getStatusBanner = (params: {
    action: Action;
    actionStatus: ActionStatus;
  }): JSX.Element => {
    const messageDictionary: Record<ActionStatus, Record<Action, string>> = {
      [ActionStatus.Idle]: {
        run: '',
        stop: '',
        logs: '',
      },
      [ActionStatus.Pending]: {
        run: 'Running...',
        stop: 'Stopping...',
        logs: '',
      },
      [ActionStatus.Succeeded]: {
        run: `Done ${appName}.yml`,
        stop: `Stopped ${appName}.yml`,
        logs: `Done ${appName}.yml`,
      },
      [ActionStatus.Errored]: {
        run: `Failed ${appName}.yml`,
        stop: `Failed ${appName}.yml`,
        logs: '',
      },
    };

    const iconDictionary: Record<ActionStatus, JSX.Element> = {
      [ActionStatus.Idle]: <></>,
      [ActionStatus.Pending]: <Spinner />,
      [ActionStatus.Succeeded]: <StatusSuccess />,
      [ActionStatus.Errored]: <StatusError />,
    };

    const { action, actionStatus } = params;
    const message = messageDictionary[actionStatus]?.[action] || '';
    const icon = iconDictionary[actionStatus] || <></>;

    return (
      <div
        className={clsx(styles['status-message'], styles[actionStatus], {
          [styles['hide-after-3s']]: actionStatus !== ActionStatus.Pending,
        })}
      >
        {icon}
        <span title={message}>{message}</span>
      </div>
    );
  };

  const canAbortRun =
    currentActionStatus === ActionStatus.Pending &&
    currentAction === Action.Run &&
    appStatus === 'stopped';

  const stopShown =
    showStop &&
    (appStatus === 'running' || appStatus === 'starting' || canAbortRun);
  const stopDisabled =
    currentActionStatus === ActionStatus.Pending &&
    currentAction === Action.Stop;

  const BANNER_CLEAN_TIME = 3500; //Animation is on 3s lasting 500ms
  const [showStatusBanner, setShowStatusBanner] = useState<
    | {
        action: Action;
        actionStatus: ActionStatus;
      }
    | undefined
  >();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    clearTimeout(timeoutRef.current || undefined);

    if (!currentAction || !isBannerEnabled || appStatus === 'stopped')
      return setShowStatusBanner(undefined);

    setShowStatusBanner({
      action: currentAction,
      actionStatus: currentActionStatus,
    });

    if (currentActionStatus !== ActionStatus.Pending) {
      timeoutRef.current = setTimeout(() => {
        setShowStatusBanner(undefined);
        timeoutRef.current = null;
      }, BANNER_CLEAN_TIME);
    }

    return () => clearTimeout(timeoutRef.current || undefined);
  }, [currentAction, currentActionStatus, isBannerEnabled]);

  const SwitchIcon =
    appDefault?.id === appId ? AppLabToggleOn : AppLabToggleOff;

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
            classes={{
              button: clsx(
                { [styles['button']]: setAsDefaultApp },
                styles['icon-only'],
              ),
            }}
            onClick={(): void => stopApp(appId, appStatus)}
            type={ButtonType.Secondary}
            size={ButtonSize.Small}
            variant={ButtonVariant.Destructive}
            disabled={stopDisabled || runtimeDisable}
            Icon={Stop}
            iconPosition="left"
          >
            Stop
          </Button>
        )}
        {!stopShown && (
          <Button
            classes={{
              button: clsx(
                { [styles['button']]: setAsDefaultApp },
                styles['icon-only'],
              ),
            }}
            onClick={(): void => runApp(appId)}
            type={ButtonType.Primary}
            size={ButtonSize.Small}
            variant={ButtonVariant.Action}
            disabled={
              currentActionStatus === ActionStatus.Pending || runtimeDisable
            }
            Icon={Play}
            iconPosition="left"
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
                          <SwitchIcon
                            onClick={(): void =>
                              setAsDefaultApp(appDefault?.id !== appId)
                            }
                          />
                        </div>
                        <XXXSmall
                          className={styles['dropdown-menu-item-content']}
                        >
                          {appDefault && appDefault.id !== appId
                            ? formatMessage(messages.overrideAsDefault, {
                                appName: (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={styles['app-name']}
                                    onClick={(): void => openApp?.(appDefault)}
                                    onKeyUp={(): void => openApp?.(appDefault)}
                                  >
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
            isOpen={open}
            onOpen={setOpen}
            classes={{
              dropdownMenu: styles['dropdown-menu'],
              dropdownMenuButton: styles['dropdown-menu-button'],
              dropdownMenuButtonOpen: styles['dropdown-menu-button--open'],
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
