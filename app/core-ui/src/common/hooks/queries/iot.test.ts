import {
  ManagedOtaErrors,
  OtaV1_Errors,
  ShowOtaV1_Response,
} from '@cloud-editor-mono/infrastructure';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';

import TestProviderWrapper from '../../../../tests-setup';
import {
  OTA_V1_RESPONSE_PENDING,
  OTA_V1_STATE_AVAILABLE,
  OTA_V1_STATE_FAIL,
  OTA_V1_STATE_FETCH,
  OTA_V1_STATE_FLASH,
  OTA_V1_STATE_REBOOT,
  OTA_V1_STATE_START,
} from './fixtures/iot.fixture';
import { IotUploadOutput } from './iot.type';
import { useIotUploadData } from './iotUtils';
import { messages } from './messages';
import { progressionLoader } from './utils/progressionLoader';
import { formatTimestamp } from './utils/timestamps';

describe('OTA api data processing', () => {
  describe('successful ota with different steps and/or outcomes', async () => {
    describe('when the ota is successful, with all steps', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return { output: output?.output, setData, isPending, isUploading };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_FETCH],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(0)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [
            ...(nextData.states ?? []),
            {
              ...OTA_V1_STATE_FETCH,
              timestamp: OTA_V1_STATE_FETCH.timestamp + 1000,
              stateData: '25',
            },
          ],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(25)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [
            ...(nextData.states ?? []),
            {
              ...OTA_V1_STATE_FETCH,
              timestamp: OTA_V1_STATE_FETCH.timestamp + 2000,
              stateData: '50',
            },
          ],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(50)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [
            ...(nextData.states ?? []),
            {
              ...OTA_V1_STATE_FETCH,
              timestamp: OTA_V1_STATE_FETCH.timestamp + 3000,
              stateData: '100',
            },
          ],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(100)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_FLASH],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FLASH.timestamp)} ${
          messages.iotState_flash.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_REBOOT],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_REBOOT.timestamp,
        )} ${messages.iotState_reboot.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'succeeded',
          },
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(nextData.ota?.endedAt)} ${
          messages.iotCompleted.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(false);
        });
      });
    });

    describe('when the ota is successful, without explicit 100% fetch stateData', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return { output: output?.output, setData, isPending, isUploading };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_FETCH],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(0)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [
            ...(nextData.states ?? []),
            {
              ...OTA_V1_STATE_FETCH,
              timestamp: OTA_V1_STATE_FETCH.timestamp + 1000,
              stateData: '25',
            },
          ],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(25)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [
            ...(nextData.states ?? []),
            {
              ...OTA_V1_STATE_FETCH,
              timestamp: OTA_V1_STATE_FETCH.timestamp + 2000,
              stateData: '50',
            },
          ],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FETCH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(50)}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_FLASH],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FLASH.timestamp)} ${
          messages.iotState_fetch.defaultMessage
        }${progressionLoader(100)}\n${formatTimestamp(
          OTA_V1_STATE_FLASH.timestamp,
        )} ${messages.iotState_flash.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_REBOOT],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_REBOOT.timestamp,
        )} ${messages.iotState_reboot.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'succeeded',
          },
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(nextData.ota?.endedAt)} ${
          messages.iotCompleted.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(false);
        });
      });
    });

    // can this actually happen?
    describe('when the ota fails, without an error reason', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return { output: output?.output, setData, isPending, isUploading };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'failed',
          },
          states: [...(nextData.states ?? []), OTA_V1_STATE_FAIL],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_FAIL.timestamp)} ${
          messages.iotState_fail.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(true); // is this appropriate?
        });
      });
    });

    describe('when the ota fails, with a managed Error', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return {
              output: output?.output,
              errorReason: output?.errorReason,
              setData,
              isPending,
              isUploading,
            };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'failed',
            errorReason: ManagedOtaErrors.Sha256Unknown,
          },
          states: [...(nextData.states ?? [])],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput = '';
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.errorReason).toBe(
            ManagedOtaErrors.Sha256Unknown,
          );
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(false);
        });
      });
    });

    describe('when the ota fails, with an unmanaged Error', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return {
              output: output?.output,
              errorReason: output?.errorReason,
              setData,
              isPending,
              isUploading,
            };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'failed',
            errorReason: OtaV1_Errors.Timeout,
          },
          states: [...(nextData.states ?? [])],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(nextData.ota?.endedAt)} ${
          messages.iotError_Timeout.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.errorReason).toBe(undefined);
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(false);
        });
      });
    });

    describe('when the ota fails, because it was cancelled by the user', () => {
      it('should return the correct expected output', async () => {
        let nextData: ShowOtaV1_Response = OTA_V1_RESPONSE_PENDING;
        let expectedOutput = `${formatTimestamp(
          OTA_V1_RESPONSE_PENDING.ota?.startedAt,
        )} ${messages.iotUploadPending.defaultMessage}`;

        const { result } = renderHook(
          () => {
            const [output, setOutput] = useState<IotUploadOutput>();
            const [isPending, setIsPending] = useState<boolean>(false);
            const [isUploading, setUploading] = useState<boolean>(true);
            const [data, setData] = useState(nextData);

            useIotUploadData(setOutput, setIsPending, setUploading, data);

            return {
              output: output?.output,
              errorReason: output?.errorReason,
              setData,
              isPending,
              isUploading,
            };
          },
          {
            wrapper: TestProviderWrapper,
          },
        );

        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(true);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'in_progress',
          },
          states: [OTA_V1_STATE_AVAILABLE],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(
          OTA_V1_STATE_AVAILABLE.timestamp,
        )} ${messages.iotState_available.defaultMessage}`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.isPending).toBe(false);
        });

        nextData = {
          ...nextData,
          states: [...(nextData.states ?? []), OTA_V1_STATE_START],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(OTA_V1_STATE_START.timestamp)} ${
          messages.iotState_start.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
        });

        nextData = {
          ...nextData,
          ota: {
            ...nextData.ota,
            status: 'failed',
            errorReason: OtaV1_Errors.CanceledByUser,
          },
          states: [...(nextData.states ?? [])],
        };
        act(() => {
          result.current.setData(nextData);
        });

        expectedOutput += `\n${formatTimestamp(nextData.ota?.endedAt)} ${
          messages.iotUploadAborted.defaultMessage
        }`;
        await waitFor(() => {
          expect(result.current.output).toBe(expectedOutput);
          expect(result.current.errorReason).toBe(undefined);
          expect(result.current.isPending).toBe(false);
          expect(result.current.isUploading).toBe(false);
        });
      });
    });
  });
});
