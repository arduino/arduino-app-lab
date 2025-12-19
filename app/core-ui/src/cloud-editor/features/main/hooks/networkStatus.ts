import {
  dismissToastNotification,
  NotificationMode,
  sendNotification,
} from '@cloud-editor-mono/domain';
import { ToastType } from '@cloud-editor-mono/ui-components';
import { uniqueId } from 'lodash';
import { useContext, useEffect, useState } from 'react';
import { defineMessages, IntlContext } from 'react-intl';
import { useNetworkState } from 'react-use';

export type UseNetworkStatus = () => ReturnType<typeof useNetworkState>;

export function useNetworkStatus(): ReturnType<UseNetworkStatus> {
  const network = useNetworkState();

  const { formatMessage } = useContext(IntlContext);

  const [networkDownToastId, setNetworkDownToastId] = useState<string>();

  useEffect(() => {
    const networkIsOnline = Boolean(network.online);
    const sideEffectRequired = networkIsOnline === Boolean(networkDownToastId);

    if (!sideEffectRequired) return;

    if (!networkIsOnline) {
      const toastId = uniqueId();
      sendNotification({
        message: formatMessage(messages.noNetworkAdvisory),
        mode: NotificationMode.Toast,
        modeOptions: {
          toastId,
          toastType: ToastType.Persistent,
        },
      });

      setNetworkDownToastId(toastId);

      return;
    }

    if (networkDownToastId) {
      dismissToastNotification(networkDownToastId);
      setNetworkDownToastId(undefined);
    }
  }, [formatMessage, network.online, networkDownToastId]);

  return network;
}

export const messages = defineMessages({
  noNetworkAdvisory: {
    id: 'nonetwork.advisory',
    defaultMessage:
      'You are offline. Auto-saving, verify and upload will be resumed when you reconnect to the internet.',
    description: 'Advisory when network is down',
  },
});
