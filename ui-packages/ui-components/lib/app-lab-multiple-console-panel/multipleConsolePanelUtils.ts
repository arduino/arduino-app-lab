import {
  Board,
  ContentUpdateLogic,
  SerialMonitorLogic,
  SerialMonitorStatus,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useEffect } from 'react';
import { BehaviorSubject, Subject } from 'rxjs';

import { messages } from './messages';
import { ConsoleLogValue } from './multipleConsolePanel.type';

type ConsolePanelBehaviorSubject = BehaviorSubject<ConsoleLogValue>;

export const createAppLabConsolePanelLogic = (
  onMessageSend: (message: string) => void,
): SerialMonitorLogic => {
  const useAppLabConsolePanelLogic: SerialMonitorLogic = (
    logSource$: ConsolePanelBehaviorSubject,
  ) => {
    const useContentUpdate: ContentUpdateLogic = (
      receiveContentUpdate: (
        content: string,
        isSentByUser: boolean,
        className?: string,
        isGlobalStyle?: boolean,
      ) => void,
      receiveContentReset: () => void,
      resetSource?: Subject<void>,
    ): void => {
      useEffect(() => {
        const s = logSource$?.subscribe({
          next(message: ConsoleLogValue) {
            receiveContentUpdate(
              message.value,
              false,
              message?.meta?.className,
              message?.meta?.isGlobalStyle,
            );
          },
          error(e: Error) {
            console.error(e);
            receiveContentReset();
          },
        });
        return () => s?.unsubscribe();
      }, [receiveContentUpdate, receiveContentReset]);

      useEffect(() => {
        const s = resetSource?.subscribe(receiveContentReset);
        return () => s?.unsubscribe();
      }, [receiveContentReset, resetSource]);
    };

    const contentUpdateLogic = useCallback(useContentUpdate, [logSource$]);

    return {
      contentUpdateLogic,
      baudRates: [9600],
      selectedBaudRate: 9600,
      onBaudRateSelected: (baudRate: number): void => {
        console.log(`New baudrate: ${baudRate} selected`);
      },
      onPlayPause: (): void => {
        console.log('Play/Pause triggered');
      },
      onMessageSend,
      clearMessages: (): void => {
        console.log(`Clear message triggered`);
      },
      status: SerialMonitorStatus.Active,
      disabled: false,
    };
  };

  return useAppLabConsolePanelLogic;
};

const buildAddress = (selectedBoard?: Board): string => {
  if (!selectedBoard) {
    return '';
  }

  if (selectedBoard.serial) {
    return `usb(${selectedBoard.serial})`;
  }
  if (selectedBoard.address) {
    return `network(${selectedBoard.address})`;
  }
  return 'local device';
};

export const useSendMessage = (selectedBoard?: Board): string => {
  const { formatMessage } = useI18n();

  if (!selectedBoard) {
    return formatMessage(messages.sendMessageNoBoardPlaceholder);
  }

  const name = selectedBoard.name;
  const address = buildAddress(selectedBoard);

  return formatMessage(messages.sendMessagePlaceholder, {
    name,
    address,
  });
};
