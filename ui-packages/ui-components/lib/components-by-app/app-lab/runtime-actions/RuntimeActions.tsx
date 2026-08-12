import {
  Play,
  Spinner,
  StatusError,
  StatusSuccess,
  Stop,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Action,
  ActionStatus,
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  RuntimeActionsProps,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import styles from './runtime-actions.module.scss';

const RuntimeActions = (props: RuntimeActionsProps): React.ReactElement => {
  const { runtimeActionsLogic, runtimeDisable } = props;

  const {
    appId,
    appName,
    appStatus,
    currentAction,
    currentActionStatus,
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
        run: `Done ${appName}`,
        stop: `Stopped ${appName}`,
        logs: `Done ${appName}`,
      },
      [ActionStatus.Errored]: {
        run: `Failed ${appName}`,
        stop: `Failed ${appName}`,
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
  }, [appStatus, currentAction, currentActionStatus, isBannerEnabled]);

  return (
    <div className={styles['actions']}>
      {showStatusBanner && getStatusBanner(showStatusBanner)}
      {stopShown ? (
        <Button
          classes={{
            button: clsx(styles['icon-only']),
          }}
          onClick={(): void => stopApp(appId, appStatus)}
          variant={ButtonVariant.Secondary}
          appearance={ButtonAppearance.Destructive}
          size={ButtonSize.XSmall}
          disabled={stopDisabled || runtimeDisable}
          Icon={Stop}
          iconPosition="left"
        >
          Stop
        </Button>
      ) : (
        <Button
          classes={{
            button: clsx(styles['icon-only']),
          }}
          onClick={(): void => runApp(appId)}
          variant={ButtonVariant.Primary}
          appearance={ButtonAppearance.Action}
          size={ButtonSize.XSmall}
          disabled={
            currentActionStatus === ActionStatus.Pending || runtimeDisable
          }
          Icon={Play}
          iconPosition="left"
        >
          Run
        </Button>
      )}
    </div>
  );
};

export default RuntimeActions;
