import { WebSocketHandlers } from '@cloud-editor-mono/infrastructure';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseWebSocket {
  connect: () => Promise<void>;
  abort: () => void;
  send: (message: string) => void;
  error: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  socketRef: React.MutableRefObject<WebSocket | null>;
  socketIsConnectingRef: React.MutableRefObject<boolean>;
}

export type AppWebSocket = (handlers: WebSocketHandlers) => Promise<WebSocket>;

export const useAppWebSocket = ({
  appWebSocket,
  handlers,
  onMessage,
}: {
  appWebSocket: AppWebSocket;
  handlers?: WebSocketHandlers;
  onMessage: (data: string) => void;
}): UseWebSocket => {
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const socketIsConnectingRef = useRef<boolean>(false);
  const abortRequestedRef = useRef<boolean>(false);

  const onmessage: WebSocketHandlers['onmessage'] = useCallback(
    async (event: MessageEvent) => {
      const message = await (event.data as Blob).text();

      onMessage(message);
      handlers?.onmessage?.(event);
    },
    [onMessage, handlers],
  );

  const onerror: WebSocketHandlers['onerror'] = useCallback(
    (event: Event) => {
      setError(`An error occurred: ${event}`);
      handlers?.onerror?.(event);
    },
    [handlers],
  );

  const onopen: WebSocketHandlers['onopen'] = useCallback(
    (event: Event) => {
      setIsConnected(true);
      setIsConnecting(false);
      handlers?.onopen?.(event);
    },
    [handlers],
  );

  const onclose: WebSocketHandlers['onclose'] = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    handlers?.onclose?.();
  }, [handlers]);

  const abort = useCallback((): void => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (socketIsConnectingRef.current) {
      abortRequestedRef.current = true;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  const connect = useCallback(async (): Promise<void> => {
    abort();

    try {
      setIsConnecting(true);
      socketIsConnectingRef.current = true;
      socketRef.current = await appWebSocket({
        onopen,
        onmessage,
        onerror,
        onclose,
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unknown WebSocket error when connecting',
      );
    } finally {
      socketIsConnectingRef.current = false;
      if (abortRequestedRef.current && socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        abortRequestedRef.current = false;
      }
      setIsConnecting(false);
    }
  }, [appWebSocket, onopen, onmessage, onerror, onclose, abort]);

  const send = useCallback((message: string): void => {
    if (socketRef.current) {
      socketRef.current.send(message);
    }
  }, []);

  return {
    connect,
    abort,
    send,
    error,
    isConnected,
    isConnecting,
    socketRef,
    socketIsConnectingRef,
  };
};
