import { messageMapperDictionary } from '../mapper';

export interface ParsedMsg {
  [key: string]: any;
}

export enum SocketIOMessageCategories {
  ListCommandPortsResponse,
  ListCommandNetworkPortsResponse,
  SerialMonitorStatusUpdate,
  SerialMonitorMessage,
  DownloadStatusResponse,
  Upload,
  Unknown,
}

export type MessageMapperDictionary = typeof messageMapperDictionary;

type MessageDataDictionary = {
  [Property in keyof MessageMapperDictionary]: ReturnType<
    MessageMapperDictionary[Property]
  >;
};

export type ActionableMessage = {
  [K in keyof MessageDataDictionary]: {
    category: K;
    data: MessageDataDictionary[K];
  };
}[keyof MessageDataDictionary];
