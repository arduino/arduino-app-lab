import {
  ManagedOtaErrors,
  OtaV1_ErrorsStrings,
  ShowOtaV1_Response,
} from '@cloud-editor-mono/infrastructure';
import { useI18n } from '@cloud-editor-mono/ui-components';
import { useEffect } from 'react';
import { usePreviousDistinct } from 'react-use';

import { IotUploadOutput, Progression } from './iot.type';
import { MessageKey, messages } from './messages';
import { getPercentage, progressionLoader } from './utils/progressionLoader';
import { formatTimestamp } from './utils/timestamps';

type UseProcessIotUploadOutput = (
  setOutput: React.Dispatch<React.SetStateAction<IotUploadOutput | undefined>>,
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>,
  setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  otaProgressData?: ShowOtaV1_Response,
) => void;

export const useIotUploadData: UseProcessIotUploadOutput = function (
  setOutput: React.Dispatch<React.SetStateAction<IotUploadOutput | undefined>>,
  setIsPending: React.Dispatch<React.SetStateAction<boolean>>,
  setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  otaProgressData?: ShowOtaV1_Response,
): ReturnType<UseProcessIotUploadOutput> {
  const { formatMessage } = useI18n();

  const prevOtaProgressData = usePreviousDistinct(otaProgressData);

  useEffect(() => {
    const data = otaProgressData;
    if (!data) return;

    const oldStatesTimestamps = prevOtaProgressData?.states?.map(
      (e) => e.timestamp,
    );

    const newStates = data.states?.filter(
      (e) => !oldStatesTimestamps?.includes(e.timestamp),
    );

    if (
      prevOtaProgressData?.ota?.status === data.ota?.status &&
      !newStates?.length
    )
      return;

    let newLog = '';
    const finalStateFromPrevData =
      prevOtaProgressData?.states?.[prevOtaProgressData?.states?.length - 1];

    const appendMessage = (
      newLog: string,
      msg: string,
      _timestamp?: string,
    ): string => {
      let log = newLog;
      const timestamp = _timestamp
        ? `${formatTimestamp(_timestamp)}${' '}`
        : undefined;

      log += `${timestamp}${msg}\n`;

      return log;
    };

    const handleNewStates = (
      data: ShowOtaV1_Response,
      newStates: Exclude<ShowOtaV1_Response['states'], undefined>,
      newLog: string,
      finalStateFromPrevData?: Exclude<
        ShowOtaV1_Response['states'],
        undefined
      >[0],
    ): { log: string } => {
      let log = newLog;
      let progress: Progression;

      for (let i = 0; i < newStates?.length; i++) {
        const message = `iotState_${newStates[i].state}` as MessageKey;
        let msg = formatMessage(messages[message]);

        if (newStates[i].state === 'fetch') {
          if (newStates[i].stateData) {
            msg += progressionLoader(
              Number(newStates[i].stateData),
              data?.ota?.firmwareSize,
            );
            progress = getPercentage(
              Number(newStates[i].stateData),
              data.ota?.firmwareSize,
            );
          }

          const finalStateWasFetchWithoutData =
            finalStateFromPrevData?.state === 'fetch' &&
            !finalStateFromPrevData?.stateData;

          const resetFetchProgress =
            !finalStateFromPrevData || !finalStateWasFetchWithoutData;

          if (!newStates[i].stateData && resetFetchProgress) {
            msg += progressionLoader(0);
            progress = ~~0 as Progression;
          }
        }

        if (
          newStates[i].state === 'flash' &&
          finalStateFromPrevData?.state === 'fetch' &&
          finalStateFromPrevData?.stateData !== '100' // unlikely to  (`stateData: '100'`) but just in case...
        ) {
          const fetchDoneMsg = `${formatMessage(
            messages.iotState_fetch,
          )}${progressionLoader(100)}`;
          log = appendMessage(log, fetchDoneMsg, newStates[i].timestamp);
          progress = 100;
        }

        log = appendMessage(log, msg, newStates[i].timestamp);
      }

      const lastNewState = newStates[newStates?.length - 1];

      const trimmedLog = log.trim();
      setOutput((prev) => ({
        ...prev,
        stage: 'upload',
        output: `${prev?.output ? `${prev.output}\n` : ''}${trimmedLog}`,
        stdout: `${prev?.stdout ? `${prev.stdout}\n` : ''}${trimmedLog}`,
        hasFailed: false,
        otaStatus: data.ota?.status,
        step: lastNewState.state,
        progression: progress,
      }));

      return { log };
    };

    const handlePending = (data: ShowOtaV1_Response): void => {
      const msg = formatMessage(messages.iotUploadPending);
      const timestamp = formatTimestamp(data.ota?.startedAt);
      setOutput((prev) => ({
        ...prev,
        stage: 'upload',
        output: `${prev?.output ? `${prev.output}\n` : ''}${timestamp} ${msg}`,
        stdout: `${prev?.stdout ? `${prev.stdout}\n` : ''}${timestamp} ${msg}`,
        hasFailed: false,
        otaStatus: data.ota?.status,
      }));
    };

    const handleSuccess = (
      data: ShowOtaV1_Response,
      newLog: string,
      appendDoneMessage: boolean,
    ): void => {
      let log = newLog;
      const msg = formatMessage(messages.iotCompleted);
      if (appendDoneMessage) {
        const fetchDoneMsg = `${formatMessage(
          messages.iotState_fetch,
        )}${progressionLoader(100)}`;
        log = appendMessage(log, fetchDoneMsg, data.ota?.endedAt);
      }

      log = appendMessage(log, msg, data.ota?.endedAt);
      const trimmedLog = log.trim();
      setOutput((prev) => ({
        ...prev,
        stage: 'upload',
        output: `${prev?.output ? `${prev.output}\n` : ''}${trimmedLog}`,
        stdout: `${prev?.stdout ? `${prev.stdout}\n` : ''}${trimmedLog}`,
        hasFailed: false,
        otaStatus: data.ota?.status,
      }));
      setUploading(false);
    };

    const handleError = (data: ShowOtaV1_Response): void => {
      const errorReason = data.ota?.errorReason;
      if (errorReason) {
        const getMessage = (status: OtaV1_ErrorsStrings): string => {
          if (status === 'CanceledByUser') {
            return formatMessage(messages.iotUploadAborted);
          }

          if (status === 'Timeout') {
            return formatMessage(messages.iotError_Timeout);
          }

          return formatMessage(messages.iotError_boardError, {
            err: status,
          });
        };

        const isManagedOtaError = (error: string): error is ManagedOtaErrors =>
          Object.values<string>(ManagedOtaErrors).includes(error);
        if (isManagedOtaError(errorReason)) {
          setOutput((prev) => ({
            ...prev,
            stage: 'upload',
            output: '',
            stdout: '',
            stderr: '',
            hasFailed: true,
            otaStatus: 'failed',
            errorReason: errorReason,
          }));
        } else {
          const timestamp = formatTimestamp(data.ota?.endedAt);
          const msg = getMessage(errorReason);

          setOutput((prev) => ({
            ...prev,
            stage: 'upload',
            output: `${
              prev?.output ? `${prev.output}\n` : ''
            }${timestamp} ${msg}`,
            stdout: `${
              prev?.stdout ? `${prev.stdout}\n` : ''
            }${timestamp} ${msg}`,
            hasFailed: true,
            otaStatus: 'failed',
          }));
        }

        setUploading(false);
      }
    };

    setIsPending(data.ota?.status === 'pending');

    if (newStates?.length) {
      const { log } = handleNewStates(
        data,
        newStates,
        newLog,
        finalStateFromPrevData,
      );
      newLog = log;
    }
    switch (data.ota?.status) {
      case 'pending':
        handlePending(data);
        return;

      case 'succeeded':
        handleSuccess(data, newLog, finalStateFromPrevData?.state === 'fetch');
        return;

      case 'failed':
        handleError(data);
        return;
    }
  }, [
    otaProgressData,
    formatMessage,
    prevOtaProgressData,
    setIsPending,
    setOutput,
    setUploading,
  ]);
};
