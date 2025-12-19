import {
  CodeSubjectById,
  dismissToastNotification,
  GetSketchesResult,
  NotificationMode,
  RetrieveExampleFileContentsResult,
  sendNotification,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  ToastType,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { uniqueId } from 'lodash';
import { useCallback, useRef } from 'react';

import { messages } from '../messages';
import {
  createUpdatedExamplePayload,
  useGetProposedSketchName,
} from '../utils';
import { UseCreateSketchFromExisting } from './queries/create.type';

type UseEditExampleNotification = (
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  useCreateSketchFromExisting: UseCreateSketchFromExisting,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  exampleInoData?: RetrieveExampleFileContentsResult,
  exampleFilesData?: RetrieveExampleFileContentsResult[],
) => {
  send: (
    exampleInoData: RetrieveExampleFileContentsResult,
    exampleFilesData?: RetrieveExampleFileContentsResult[],
  ) => void;
};

export const useEditExampleNotification: UseEditExampleNotification = function (
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  useCreateSketchFromExisting: UseCreateSketchFromExisting,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  exampleInoData?: RetrieveExampleFileContentsResult,
): ReturnType<UseEditExampleNotification> {
  const notificationIsOpen = useRef(false);

  const { create: createSketchFromExample } = useCreateSketchFromExisting();
  const { formatMessage } = useI18n();

  const { getProposedSketchName } = useGetProposedSketchName(
    retrieveSketches,
    exampleInoData,
  );

  const send = useCallback(
    (
      exampleInoData: RetrieveExampleFileContentsResult,
      exampleFilesData?: RetrieveExampleFileContentsResult[],
    ) => {
      if (!notificationIsOpen.current) {
        notificationIsOpen.current = true;
        const toastId = uniqueId();
        sendNotification({
          message: formatMessage(messages.exampleModificationAdvisory),
          mode: NotificationMode.Toast,
          modeOptions: {
            toastId,
            toastType: ToastType.Persistent,
            onUnmount: () => {
              notificationIsOpen.current = false;
            },
            toastActions: [
              {
                id: uniqueId(),
                label: formatMessage(messages.exampleModificationCopy),
                handler: async (): Promise<void> => {
                  const { exampleIno, exampleFiles } =
                    createUpdatedExamplePayload(
                      getCodeSubjectById,
                      exampleInoData,
                      exampleFilesData,
                    );

                  const proposedSketchName = await getProposedSketchName();

                  createSketchFromExample({
                    sketchName: proposedSketchName,
                    sketchContent: exampleIno.data,
                    files: exampleFiles,
                  });
                  dismissToastNotification(toastId);
                },
              },
            ],
          },
        });
      }
    },
    [
      createSketchFromExample,
      formatMessage,
      getCodeSubjectById,
      getProposedSketchName,
    ],
  );

  return { send };
};
