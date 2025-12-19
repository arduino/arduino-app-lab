import { MappedPort } from '@cloud-editor-mono/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isEqual } from 'lodash';
import { createElement, FC, useCallback, useState } from 'react';
import { BehaviorSubject, Subject } from 'rxjs';
import { AudioContext as MockAudioContext } from 'standardized-audio-context-mock';

import { useObservable } from './src/common/hooks/useObservable';
import AuthContextProvider from './src/common/providers/auth/AuthContextProvider';
import { I18nProvider } from './src/common/providers/i18n/I18nContextProvider';
import {
  MappedPorts,
  UseSerialCommunication,
} from './src/common/providers/serial-communication/serialCommunicationContext';
import SerialCommunicationContextProvider from './src/common/providers/serial-communication/SerialCommunicationContextProvider';

global.AudioContext = MockAudioContext as unknown as {
  new (): AudioContext;
  prototype: AudioContext;
};

class Worker extends EventTarget {
  url: string;
  constructor(stringUrl: string) {
    super();
    this.url = stringUrl;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postMessage(_msg: any): void {}
}

vi.stubGlobal('Worker', Worker);

vi.mock('./src/common/providers/auth/authContextProvider.logic', () => {
  return {
    useAuth: () => ({
      client: {},
      user: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore // TODO fix type errors, and remove ts-ignore comment (added for build)
        id: '1',
        name: 'test-user',
        email: 'asd@test.cc',
      },
      isAuthInjected: false,
      userNotTargetAudience: false,
      compileUsageExceeded: false,
    }),
  };
});

vi.mock('@bcmi-labs/art-auth', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...(original as object),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => {
      return {
        syncAuthState: () => {},
      };
    },
  };
});

const mockUploadStream = new Subject<string>();
const mockMappedPortsObservable = new BehaviorSubject<MappedPorts>([]);

function emitValueForMappedPorts(mappedPorts: MappedPorts): void {
  mockMappedPortsObservable.next(mappedPorts);
}

export function test_AddMappedPort(port: MappedPort): void {
  const mappedPorts = mockMappedPortsObservable.getValue();
  emitValueForMappedPorts([...mappedPorts, port]);
}

export function test_RemoveMappedPort(id: string): void {
  const mappedPorts = mockMappedPortsObservable.getValue();
  emitValueForMappedPorts(mappedPorts.filter((p) => p.id !== id));
}

export function test_RemoveAllMappedPorts(): void {
  emitValueForMappedPorts([]);
}

export function test_ReemitMappedPorts(): void {
  emitValueForMappedPorts([...mockMappedPortsObservable.getValue()]);
}

vi.mock(
  './src/common/providers/serial-communication/serialCommunicationContextProvider.logic',
  () => {
    return {
      useSerialCommunication: (): ReturnType<UseSerialCommunication> => {
        const mappedPorts = useObservable(mockMappedPortsObservable);

        const [updatedPorts, setUpdatedPorts] = useState<
          {
            portBoardId: string;
            props: Partial<MappedPort>;
          }[]
        >([]);

        const updatePortInfo = useCallback(
          (portBoardId: string, props: Partial<MappedPort>): void => {
            if (!mappedPorts || mappedPorts.length === 0) return;

            const port = mappedPorts.find((p) => p.portBoardId === portBoardId);
            if (!port) return;

            setUpdatedPorts((prev) => {
              const portPreviouslyUpdated = prev.find(
                (p) => p.portBoardId === portBoardId,
              );

              const updatedPort = {
                ...(portPreviouslyUpdated
                  ? portPreviouslyUpdated
                  : { portBoardId }),
                props,
              };

              if (
                portPreviouslyUpdated &&
                isEqual(portPreviouslyUpdated, updatedPort)
              ) {
                return prev;
              }

              return [
                ...prev.filter((p) => p.portBoardId !== portBoardId),
                updatedPort,
              ];
            });
          },
          [mappedPorts],
        );

        const clearUpdatedPortInfo = useCallback((identifier: string): void => {
          setUpdatedPorts((prev) =>
            prev?.filter((port) => port.portBoardId !== identifier),
          );
        }, []);

        const mappedPortsUpdated =
          mappedPorts?.map((port) => {
            const updatedPort = updatedPorts.find(
              (p) => p.portBoardId === port.portBoardId,
            );
            if (!updatedPort) return port;

            return {
              ...port,
              ...updatedPort.props,
            };
          }) || [];

        return {
          forceUpdate: () => {
            return;
          },
          detectBoards: async () => {
            return {
              usbProductId: 10001,
              usbVendorId: 10001,
            };
          },
          mappedPorts: mappedPortsUpdated,
          upload: () => {
            return;
          },
          uploadStream: mockUploadStream,
          clearUploadStream: () => {
            return;
          },
          uploadIsCompiling: false,
          uploadIsComputing: false,
          uploadIsUploading: false,
          compileHasFailed: false,
          uploadHasError: false,
          updatePortInfo,
          clearUpdatedPortInfo,
          busyPorts: [],
          updatedPorts: [],
        };
      },
    };
  },
);

const queryClient = new QueryClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TestProviderWrapper: FC<any> = ({ children }) =>
  createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      SerialCommunicationContextProvider,
      null,
      createElement(
        AuthContextProvider,
        null,
        createElement(I18nProvider, null, children),
      ),
    ),
  );

beforeEach(() => {
  queryClient.clear();
});

export default TestProviderWrapper;
