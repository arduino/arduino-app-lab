import { Send } from '@cloud-editor-mono/domain';

export type UseBroadcastChannel = () => {
  send: Send;
};
