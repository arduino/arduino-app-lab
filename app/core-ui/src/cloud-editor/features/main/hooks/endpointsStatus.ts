import { Config } from '@cloud-editor-mono/common';
import {
  checkCoreEndpoints,
  dismissToastNotification,
  EndpointStatus,
  getNewWindow,
  isPlayStoreApp,
  NotificationMode,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { ToastType } from '@cloud-editor-mono/ui-components';
import { useQuery } from '@tanstack/react-query';
import { uniqueId } from 'lodash';
import { useContext, useEffect, useState } from 'react';
import { defineMessages, IntlContext } from 'react-intl';

export type UseCoreEndpointsStatus = (enabled: boolean) => {
  builder?: EndpointStatus;
  create?: EndpointStatus;
  agent?: EndpointStatus;
};

export function useCoreEndpointsStatus(
  enabled: boolean,
  intervalMS: number,
): ReturnType<UseCoreEndpointsStatus> {
  const { data } = useQuery(['endpoints-status'], checkCoreEndpoints, {
    refetchInterval: intervalMS,
    enabled,
    cacheTime: 0,
  });

  const { formatMessage } = useContext(IntlContext);

  const [agentDownToastId, setAgentDownToastId] = useState<string>();
  const [builderDownToastId, setBuilderDownToastId] = useState<string>();
  const [createDownToastId, setCreateDownToastId] = useState<string>();

  useEffect(() => {
    const agentIsDown = Boolean(data?.agent === EndpointStatus.Down);
    const sideEffectRequired = agentIsDown !== Boolean(agentDownToastId);

    if (!sideEffectRequired) return;

    if (agentIsDown) {
      const toastId = uniqueId();
      sendNotification({
        message: formatMessage(messages.noAgentAdvisory),
        mode: NotificationMode.Toast,
        modeOptions: {
          toastId,
          toastType: ToastType.Persistent,
          ...(!isPlayStoreApp() && {
            toastActions: [
              {
                id: uniqueId(),
                label: formatMessage(messages.learnMore),
                handler: (): void => {
                  getNewWindow(Config.ARDUINO_SUPPORT_AGENT_URL);
                },
              },
            ],
          }),
        },
      });

      setAgentDownToastId(toastId);

      return;
    }

    if (agentDownToastId) {
      dismissToastNotification(agentDownToastId);
      setAgentDownToastId(undefined);
    }
  }, [agentDownToastId, data?.agent, formatMessage]);

  useEffect(() => {
    const builderIsDown = Boolean(data?.builder === EndpointStatus.Down);
    const sideEffectRequired = builderIsDown !== Boolean(builderDownToastId);

    if (!sideEffectRequired) return;

    if (builderIsDown) {
      const toastId = uniqueId();
      sendNotification({
        message: formatMessage(messages.noBuilderAdvisory),
        mode: NotificationMode.Toast,
        modeOptions: {
          toastId,
          toastType: ToastType.Persistent,
          ...(!isPlayStoreApp() && {
            toastActions: [
              {
                id: uniqueId(),
                label: formatMessage(messages.learnMore),
                handler: (): void => {
                  getNewWindow(Config.ARDUINO_STATUS_URL);
                },
              },
            ],
          }),
        },
      });

      setBuilderDownToastId(toastId);

      return;
    }

    if (builderDownToastId) {
      dismissToastNotification(builderDownToastId);
      setBuilderDownToastId(undefined);
    }
  }, [builderDownToastId, data?.builder, formatMessage]);

  useEffect(() => {
    const createIsDown = Boolean(data?.create === EndpointStatus.Down);
    const sideEffectRequired = createIsDown !== Boolean(createDownToastId);

    if (!sideEffectRequired) return;

    if (createIsDown) {
      const toastId = uniqueId();
      sendNotification({
        message: formatMessage(messages.noCreateAdvisory),
        mode: NotificationMode.Toast,
        modeOptions: {
          toastId,
          toastType: ToastType.Persistent,
          ...(!isPlayStoreApp() && {
            toastActions: [
              {
                id: uniqueId(),
                label: formatMessage(messages.checkStatus),
                handler: (): void => {
                  getNewWindow(Config.ARDUINO_STATUS_URL);
                },
              },
            ],
          }),
        },
      });

      setCreateDownToastId(toastId);

      return;
    }

    if (createDownToastId) {
      dismissToastNotification(createDownToastId);
      setCreateDownToastId(undefined);
    }
  }, [createDownToastId, data?.create, formatMessage]);

  return {
    builder: data?.builder || undefined,
    create: data?.create || undefined,
    agent: data?.agent || undefined,
  };
}

export const messages = defineMessages({
  learnMore: {
    id: 'endpointStatus.learn-more-label',
    defaultMessage: 'Learn More',
    description: 'Label for learn more CTA',
  },
  checkStatus: {
    id: 'endpointStatus.check-status-label',
    defaultMessage: 'Check Status',
    description: 'Label for Check Status CTA',
  },
  noAgentAdvisory: {
    id: 'endpointStatus.agent-down',
    defaultMessage:
      'To upload a Sketch via USB port, make sure the Cloud Agent is installed and running on this computer.',
    description: 'Advisory given to user when create agent is not detected',
  },
  noBuilderAdvisory: {
    id: 'endpointStatus.builder-down',
    defaultMessage:
      'We are encountering some issues, verify and upload are temporarily unavailable.',
    description: 'Advisory given to user when builder-api is not alive',
  },
  noCreateAdvisory: {
    id: 'endpointStatus.create-down',
    defaultMessage:
      'We are encountering some issues, sketch saving is temporarily unavailable.',
    description: 'Advisory given to user when create-api is not alive',
  },
});
