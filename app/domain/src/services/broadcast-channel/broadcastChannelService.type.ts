export type Message<T = unknown> = {
  type: string;
  data: T;
  meta: {
    holderSketchID: string | undefined;
  };
};
export type Send<T = unknown> = (type?: string, data?: T) => void;
export type MessageHandler = (message: Message) => void;
