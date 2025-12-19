import { WebSocketHandlers } from './websocket.type';

export function getWebSocket(
  url: string,
  handlers: WebSocketHandlers,
): Promise<WebSocket> {
  const ws = new WebSocket(url);

  if (handlers.onopen) ws.addEventListener('open', handlers.onopen);
  if (handlers.onmessage) ws.addEventListener('message', handlers.onmessage);
  if (handlers.onerror) ws.addEventListener('error', handlers.onerror);

  function onClose(): void {
    handlers.onclose?.();

    if (handlers.onopen) ws.removeEventListener('open', handlers.onopen);
    if (handlers.onmessage)
      ws.removeEventListener('message', handlers.onmessage);
    if (handlers.onerror) ws.removeEventListener('error', handlers.onerror);

    ws.removeEventListener('close', onClose);
  }

  ws.addEventListener('close', onClose);

  return new Promise((resolve, reject) => {
    const onOpen = (): void => {
      resolve(ws);
      ws.removeEventListener('open', onOpen);
    };
    ws.addEventListener('open', onOpen);

    const onError = (event: Event): void => {
      reject(new Error(`WebSocket error when connecting: ${event}`));
      ws.removeEventListener('error', onError);
    };
    ws.addEventListener('error', onError);

    const onClose = (): void => {
      reject(
        new Error('WebSocket closed before connection could be established'),
      );
      ws.removeEventListener('close', onClose);
    };
    ws.addEventListener('close', onClose);

    setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
  });
}
