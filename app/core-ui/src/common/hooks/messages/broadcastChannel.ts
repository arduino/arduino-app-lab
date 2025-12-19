import {
  getChannel,
  MessageHandler,
  registerHandler,
  send,
  unregisterHandler,
} from '@cloud-editor-mono/domain';
import { useEffect } from 'react';

import { UseBroadcastChannel } from './broadcastChannel.type';

export function useMessage(
  type: string,
  cb: MessageHandler,
): ReturnType<UseBroadcastChannel> {
  useEffect(() => {
    getChannel();
  }, []);

  useEffect(() => {
    registerHandler(type, cb);

    return () => {
      unregisterHandler(type);
    };
  }, [cb, type]);

  return { send };
}
