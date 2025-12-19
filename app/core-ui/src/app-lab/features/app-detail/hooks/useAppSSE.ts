import {
  ErrorData,
  EventSourceHandlers,
  MessageData,
  StreamEvent,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LINE_SEPARATOR } from '../constants';

type Connect<T> = T extends AppSSEWithId
  ? (id: string) => Promise<void>
  : () => Promise<void>;

interface UseSSE<T> {
  connect: Connect<T>;
  abort: () => void;
  progress: number;
  error: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  abortController: React.MutableRefObject<AbortController | null>;
}

export type AppSSEWithId = (
  id: string,
  handlers: EventSourceHandlers,
  abortController?: AbortController,
) => Promise<void>;

export type AppSSE = (
  handlers: EventSourceHandlers,
  abortController?: AbortController,
) => Promise<void>;

export const useAppSSE = <T extends AppSSE | AppSSEWithId>({
  appSSE,
  handlers: {
    onmessage: handleOnMessage,
    onerror: handleOnError,
    onopen: handleOnOpen,
    onclose: handleOnClose,
  } = {},
  onSuccess,
  onError,
  onMessage,
}: {
  appSSE: T;
  handlers?: Partial<EventSourceHandlers>;
  onSuccess?: () => void;
  onError?: (data?: ErrorData) => void;
  onMessage?: (data: MessageData) => void;
}): UseSSE<T> => {
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverClosed, setServerClosed] = useState<boolean>(false);

  const abort = useCallback((): void => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }

    setIsConnected(false);
    setProgress(0);
    setError(null);
  }, []);

  useEffect(() => {
    if (
      progress === 100 &&
      !error &&
      serverClosed &&
      !isConnected &&
      onSuccess
    ) {
      onSuccess();
      abort();
    }
  }, [error, isConnected, onSuccess, progress, serverClosed, abort]);

  const onmessage: EventSourceHandlers['onmessage'] = useCallback(
    (event: EventSourceMessage) => {
      let normalizedEvent: StreamEvent;
      try {
        const parsedData = JSON.parse(event.data);

        if (parsedData?.message) {
          //Trim the spaces at the start
          parsedData.message = parsedData.message.trimStart();

          //!Add the line separator
          parsedData.message += LINE_SEPARATOR;
        }

        normalizedEvent = {
          event: event.event as StreamEventType,
          data: parsedData,
        };
      } catch (parseError) {
        console.warn(parseError);
        return;
      }

      if (normalizedEvent.event === StreamEventType.Progress) {
        setProgress(normalizedEvent.data.progress);
      }

      if (normalizedEvent.event === StreamEventType.Error) {
        if (normalizedEvent.data.code === 'SERVER_CLOSED') {
          setServerClosed(true);
          return;
        }

        setError(normalizedEvent.data.code);
        onError?.(normalizedEvent.data);
      }

      if (normalizedEvent.event === StreamEventType.Message && onMessage) {
        onMessage(normalizedEvent.data);
      }

      handleOnMessage?.(event);
    },
    [handleOnMessage, onError, onMessage],
  );

  const onerror: EventSourceHandlers['onerror'] = useCallback(
    (error: Error) => {
      setError(error.message || 'An error occurred');
      onError?.();
      handleOnError?.(error);
    },
    [handleOnError, onError],
  );

  const onopen: EventSourceHandlers['onopen'] = useCallback(
    async (response: Response) => {
      setIsConnected(true);
      setIsConnecting(false);
      handleOnOpen?.(response);
    },
    [handleOnOpen],
  );

  const onclose: EventSourceHandlers['onclose'] = useCallback(() => {
    setIsConnected(false);
    handleOnClose?.();
  }, [handleOnClose]);

  const connect = useCallback(
    async (id?: string) => {
      abort();

      abortController.current = new AbortController();
      try {
        setIsConnecting(true);
        const sseHandlers: EventSourceHandlers = {
          onmessage,
          onerror,
          onopen,
          onclose,
        };

        if (id) {
          await (appSSE as AppSSEWithId)(
            id,
            sseHandlers,
            abortController.current,
          );
        } else {
          await (appSSE as AppSSE)(sseHandlers, abortController.current);
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : 'Unknown SSE error when connecting',
        );
        setIsConnecting(false);
      }
    },
    [abort, appSSE, onclose, onerror, onmessage, onopen],
  );

  return {
    connect: connect as Connect<T>,
    abort,
    error,
    progress,
    isConnected,
    isConnecting,
    abortController,
  };
};
