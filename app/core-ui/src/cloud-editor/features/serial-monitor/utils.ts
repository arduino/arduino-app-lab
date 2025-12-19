import { SerialMonitorWindowUpdates } from '../main/hooks/serialMonitorWindow';

export function sendSerialMonitorMsg(
  sender: Window,
  target: string,
  type: SerialMonitorWindowUpdates,
): void {
  if (!sender.opener) {
    throw new Error(
      `message type: ${type} can only be sent from a child window`,
    );
  }

  setTimeout(() => {
    sender.opener.postMessage(
      {
        type,
      },
      target,
    );
  });
}
