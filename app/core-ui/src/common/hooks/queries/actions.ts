import { useCallback, useContext, useRef } from 'react';
import { MessageDescriptor } from 'react-intl';

import { NotificationsContext } from '../../providers/notifications/notificationsContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UseFailuresHandler<Return, Args extends any[]> = (config: {
  getKeyFromAction: (...args: Args) => string;
  action: (...args: Args) => Promise<Return | void>;
  successMessage: MessageDescriptor;
  onFailure?: (err: Error, actionArgs: Args) => void;
  alwaysShowSuccessMessage?: boolean;
  customErrors?: Map<ErrorConstructor, MessageDescriptor>;
}) => {
  wrappedAction: (...args: Args) => Promise<Return | void>;
};

type ActionKey = string;
type ToastId = string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useActionFailuresHandler<Return, Args extends any[]>({
  getKeyFromAction,
  action,
  successMessage,
  onFailure,
  alwaysShowSuccessMessage = false,
  customErrors,
}: Parameters<UseFailuresHandler<Return, Args>>[0]): ReturnType<
  UseFailuresHandler<Return, Args>
> {
  const failedActions = useRef<Map<ActionKey, ToastId>>(new Map());

  const { sendSuccessNotification, sendErrorNotification } =
    useContext(NotificationsContext);

  const wrappedAction = useCallback(
    async (...args: Args) => {
      const key = getKeyFromAction(...args);
      try {
        const result = await action(...args);
        if (failedActions.current.has(key) || alwaysShowSuccessMessage) {
          const toastId = failedActions.current.get(key) as ToastId;
          sendSuccessNotification(successMessage, toastId);
        }
        failedActions.current.delete(key);
        return result;
      } catch (err) {
        onFailure && onFailure(err as Error, args);
        const currentToastId = failedActions.current.get(key);
        const error = err as Error;
        const customError = customErrors?.get(
          error.constructor as ErrorConstructor,
        );
        const { toastId } = sendErrorNotification(
          () => {
            wrappedAction(...args);
          },
          currentToastId,
          customError,
          customError
            ? {
                hasErrorMessage: Boolean(error.message),
                errorMessage: error.message,
              }
            : undefined,
        );
        failedActions.current.set(key, toastId);
      }
    },
    [
      getKeyFromAction,
      action,
      alwaysShowSuccessMessage,
      sendSuccessNotification,
      successMessage,
      onFailure,
      sendErrorNotification,
      customErrors,
    ],
  );

  return {
    wrappedAction,
  };
}
