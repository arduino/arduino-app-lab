import { getCloudEditorInstanceId } from '../window';
import { MessageHandler, Send } from './broadcastChannelService.type';

let channel: BroadcastChannel;
const handlers = {} as Record<string, MessageHandler>;

function instantiateBroadcastChannel(): BroadcastChannel {
  channel = new BroadcastChannel('arduino_cloud_editor');

  channel.onmessage = (ev): void => {
    if (ev.data.type in handlers) {
      handlers[ev.data.type](ev.data);
    }
  };

  return channel;
}

export function getChannel(): BroadcastChannel {
  let c = channel;
  if (c) return c;

  c = instantiateBroadcastChannel();

  return c;
}

export const send: Send = (type, data) => {
  if (!type) {
    throw new Error('Missing event type');
  }

  const cloudEditorInstanceId = getCloudEditorInstanceId();
  getChannel().postMessage({
    type,
    data,
    meta: { cloudEditorInstanceId },
  });
};

export function registerHandler(type: string, cb: MessageHandler): void {
  handlers[type] = cb;
}

export function unregisterHandler(type: string): void {
  delete handlers[type];
}

export function closeChannel(): void {
  getChannel().close();
}
