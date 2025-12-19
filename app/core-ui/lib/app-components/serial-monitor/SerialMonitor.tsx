import {
  SerialMonitor,
  SerialMonitorLogic,
  SerialMonitorStatus,
} from '@cloud-editor-mono/ui-components';
import { useCallback, useEffect, useRef } from 'react';

let reset = () => {};

const App: React.FC = () => {
  const useContentUpdate = (
    receiveContentUpdate: (content: string, isSentByUser: boolean) => void,
    receiveContentReset: () => void,
  ): void => {
    const firstRender = useRef(true);
    useEffect(() => {
      if (firstRender.current)
        receiveContentUpdate('serial monitor content', false);

      reset = receiveContentReset;
      return () => {
        firstRender.current = false;
      };
    }, [receiveContentReset, receiveContentUpdate]);
  };

  const contentUpdateLogic = useCallback(useContentUpdate, []);

  return (
    <SerialMonitor
      serialMonitorLogic={(): ReturnType<SerialMonitorLogic> => ({
        deviceName: '',
        portName: '',
        contentUpdateLogic: contentUpdateLogic,
        baudRates: [],
        selectedBaudRate: 0,
        onBaudRateSelected: (baudRate: number): void => {
          console.log(`New baudrate: ${baudRate} selected`);
        },
        onPlayPause: (): void => {
          console.log('Play/Pause triggered');
        },
        onMessageSend: (message: string): void => {
          console.log(`Message: ${message} sent to serial monitor`);
        },
        clearMessages: reset,
        status: SerialMonitorStatus.Active,
        disabled: false,
      })}
    />
  );
};

export default App;
