import {
  SerialMonitor,
  serialMonitorsDisconnectionsNext,
  serialMonitorsMsgStreamNext,
  SerialMonitorStatus,
  uploadResponseStreamNext,
  UploadStatus,
} from '@cloud-editor-mono/board-communication-tools';

import {
  AgentDownloadStatus,
  AgentUploadStatus,
  DownloadQuotaItemStatus,
} from '../../lib';
import { daemonState, setAgentDaemonState } from '../daemon/state';
import { AgentDaemonStateKeys } from '../daemon/state.type';
import { messageMapperDictionary } from '../mapper';
import {
  ActionableMessage,
  MessageMapperDictionary,
  ParsedMsg,
  SocketIOMessageCategories,
} from './socket.type';

function executeMessageSideEffects(message: ActionableMessage): void {
  const { category, data } = message;

  if (category === SocketIOMessageCategories.ListCommandPortsResponse) {
    // if the quota is empty, the msg is not expected, it was likely requested from another client,
    // thus we bail
    if (!daemonState[AgentDaemonStateKeys.PortsListQuota].length) return;

    setAgentDaemonState({
      [AgentDaemonStateKeys.PortsListQuota]:
        daemonState[AgentDaemonStateKeys.PortsListQuota].slice(1),
    });
    setAgentDaemonState({ [AgentDaemonStateKeys.Ports]: data.ports });
  }

  if (category === SocketIOMessageCategories.ListCommandNetworkPortsResponse) {
    setAgentDaemonState({ [AgentDaemonStateKeys.NetworkPorts]: data.ports });
  }

  if (category === SocketIOMessageCategories.DownloadStatusResponse) {
    // the agent does not identify the pkg for which a download status message is related
    // thus the below logic just fulfills a quota, n downloadRequests should = n downloadStatus
    // "Success/Error" messages
    const { downloadQuota } = daemonState;

    const requestIndex = downloadQuota.findIndex(
      (item) =>
        item.status === DownloadQuotaItemStatus.Sent ||
        item.status === DownloadQuotaItemStatus.Pending,
    );
    if (requestIndex === -1) return;

    const request = downloadQuota[requestIndex];

    if (data.status === AgentDownloadStatus.Pending) {
      if (request.status === DownloadQuotaItemStatus.Pending) return;

      downloadQuota[requestIndex] = {
        ...request,
        status: DownloadQuotaItemStatus.Pending,
      };
      setAgentDaemonState({
        [AgentDaemonStateKeys.DownloadQuota]: downloadQuota,
      });
      return;
    }

    if (data.status === AgentDownloadStatus.Success) {
      downloadQuota[requestIndex] = {
        ...request,
        status: DownloadQuotaItemStatus.Success,
      };
      setAgentDaemonState({
        [AgentDaemonStateKeys.DownloadQuota]: downloadQuota,
      });
      return;
    }

    downloadQuota[requestIndex] = {
      ...request,
      status: DownloadQuotaItemStatus.Error,
    };
    setAgentDaemonState({
      [AgentDaemonStateKeys.DownloadQuota]: downloadQuota,
    });
  }

  if (category === SocketIOMessageCategories.Upload) {
    if (!daemonState[AgentDaemonStateKeys.UploadQuota].length) return;

    if (data?.flash === 'Ok' && data.status === AgentUploadStatus.Done) {
      setAgentDaemonState({
        [AgentDaemonStateKeys.UploadStatus]: UploadStatus.DONE,
      });
      uploadResponseStreamNext(setAgentDaemonState, daemonState, data.flash);
      return;
    }

    switch (data.status) {
      case AgentUploadStatus.Starting:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.IN_PROG,
        });
        break;
      case AgentUploadStatus.Busy:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.IN_PROG,
        });
        break;
      case AgentUploadStatus.Error:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.ERROR,
        });
        break;
      case AgentUploadStatus.Killed:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.ERROR,
        });
        break;
      case AgentUploadStatus.NotFound:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.ERROR,
        });
        break;
      default:
        setAgentDaemonState({
          [AgentDaemonStateKeys.UploadStatus]: UploadStatus.IN_PROG,
        });
    }

    // if upload status is error or done
    const uploadEnded =
      daemonState[AgentDaemonStateKeys.UploadStatus] === UploadStatus.ERROR ||
      daemonState[AgentDaemonStateKeys.UploadStatus] === UploadStatus.DONE;

    if (uploadEnded) {
      setAgentDaemonState({
        [AgentDaemonStateKeys.UploadQuota]:
          daemonState[AgentDaemonStateKeys.UploadQuota].slice(1),
      });
    }

    if (data.message) {
      uploadResponseStreamNext(setAgentDaemonState, daemonState, data.message);
    }
  }

  if (category === SocketIOMessageCategories.SerialMonitorStatusUpdate) {
    const serialMonitors = daemonState[AgentDaemonStateKeys.SerialMonitors];
    const serialMonitorIndex = serialMonitors.findIndex(
      (sm) => sm.port === data.port,
    );
    const serialMonitorExists = serialMonitorIndex !== -1;

    let newSerialMonitors: SerialMonitor[];

    switch (data.status) {
      case SerialMonitorStatus.Open:
      case SerialMonitorStatus.OpenFail: {
        // type narrowing in switch cases is not already supported by TS
        const status = data.status as
          | SerialMonitorStatus.Open
          | SerialMonitorStatus.OpenFail;

        const persistingStatusesDict = {
          [SerialMonitorStatus.Open]: SerialMonitorStatus.OPENED,
          [SerialMonitorStatus.OpenFail]: SerialMonitorStatus.FAILED,
        };

        if (serialMonitorExists) {
          if (status === SerialMonitorStatus.OpenFail) {
            serialMonitorsDisconnectionsNext(
              setAgentDaemonState,
              daemonState,
              data.port,
            );
          }

          // update the list
          newSerialMonitors = serialMonitors.map((sm) => {
            if (sm.port === data.port) {
              return {
                ...sm,
                status: persistingStatusesDict[status],
              };
            } else {
              return sm;
            }
          });
        } else {
          // add to list
          newSerialMonitors = [
            ...serialMonitors,
            {
              status: persistingStatusesDict[status],
              port: data.port,
              baudRate: data.baudRate,
            },
          ];
        }
        break;
      }
      case SerialMonitorStatus.Close:
        if (serialMonitorExists) {
          serialMonitorsDisconnectionsNext(
            setAgentDaemonState,
            daemonState,
            data.port,
          );

          // remote it from the list
          newSerialMonitors = serialMonitors.filter(
            (sm) => sm.port !== data.port,
          );
        } else {
          newSerialMonitors = serialMonitors;
        }
        break;
      default:
        newSerialMonitors = serialMonitors;
    }

    setAgentDaemonState({
      [AgentDaemonStateKeys.SerialMonitors]: newSerialMonitors,
    });
  }

  if (category === SocketIOMessageCategories.SerialMonitorMessage) {
    serialMonitorsMsgStreamNext(setAgentDaemonState, daemonState, data);
  }
}

function mapAgentMessageData<T extends SocketIOMessageCategories>(
  data: any,
  messageCategory: T,
): ReturnType<MessageMapperDictionary[T]> {
  const mapper = messageMapperDictionary[messageCategory];
  return mapper(data);
}

function categoriseAgentMessage(
  parsedMsg: ParsedMsg,
): SocketIOMessageCategories {
  let messageCategory: SocketIOMessageCategories =
    SocketIOMessageCategories.Unknown;

  const isListCommandResponse = parsedMsg.Ports;
  const responseIsNetworkPorts = parsedMsg.Network;

  if (isListCommandResponse && !responseIsNetworkPorts) {
    messageCategory = SocketIOMessageCategories.ListCommandPortsResponse;
  }

  if (isListCommandResponse && responseIsNetworkPorts) {
    messageCategory = SocketIOMessageCategories.ListCommandNetworkPortsResponse;
  }

  const isDownloadStatusResponse = parsedMsg.DownloadStatus;
  if (isDownloadStatusResponse) {
    messageCategory = SocketIOMessageCategories.DownloadStatusResponse;
  }

  const isProgrammerStatus = parsedMsg.ProgrammerStatus;
  if (isProgrammerStatus) {
    messageCategory = SocketIOMessageCategories.Upload;
  }

  const isSetSerailMonitorStatusUpdate = parsedMsg.Cmd in SerialMonitorStatus;
  if (isSetSerailMonitorStatusUpdate) {
    messageCategory = SocketIOMessageCategories.SerialMonitorStatusUpdate;
  }

  const isSerialMonitorMessage = parsedMsg.P && parsedMsg.D;
  if (isSerialMonitorMessage) {
    messageCategory = SocketIOMessageCategories.SerialMonitorMessage;
  }

  return messageCategory;
}

function parseAgentMessage(message: string): ParsedMsg {
  try {
    const parsedMsg = JSON.parse(message);

    return parsedMsg;
  } catch {
    return {};
  }
}

export function messageEventHandler(message: string): void {
  // console.log('agent-message', message);
  const data = parseAgentMessage(message);

  const messageCategory = categoriseAgentMessage(data);
  const mappedData = mapAgentMessageData(data, messageCategory);

  executeMessageSideEffects({ category: messageCategory, data: mappedData });
}
