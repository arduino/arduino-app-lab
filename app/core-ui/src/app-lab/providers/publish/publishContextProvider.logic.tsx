import { BOARD_FQBN } from '@cloud-editor-mono/common';
import {
  createProjectHubDraft,
  exportAppArchive,
  openLinkExternal,
  ProjectHubDraft,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { CircleSlash } from '@cloud-editor-mono/images/assets/icons';
import {
  AppDetailedInfo,
  PROJECT_HUB_BOARD_SKU,
  ProjectHubBoardSku,
} from '@cloud-editor-mono/infrastructure';
import {
  BannerAction,
  BannerProps,
  publishAppMessages as messages,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { MessageDescriptor } from 'react-intl';

import { sendAppLabNotification } from '../../features/notifications';
import { useBoardLifecycleStore } from '../../store/boardLifecycle';
import { useBoardResourcesStore } from '../../store/boardResources';

type PublishPhase = 'exporting' | 'uploading';

type PublishRequest = {
  appId: string;
  appName: string;
  fileName: string;
  includeData: boolean;
  board?: ProjectHubBoardSku;
};

type PublishVariables = {
  request: PublishRequest;
  abortController: AbortController;
};

const phaseMessages: Record<PublishPhase, MessageDescriptor> = {
  exporting: messages.phaseExporting,
  uploading: messages.phaseUploading,
};

const USER_ABORT = 'publish/user-abort';
const SUPERSEDED = 'publish/superseded';

const RAM_THRESHOLD_BYTES = 3 * 1024 ** 3;

export function projectHubBoardSku(
  fqbn?: string,
  totalRamBytes?: number,
): ProjectHubBoardSku | undefined {
  if (fqbn === BOARD_FQBN.VENTUNO_Q) return PROJECT_HUB_BOARD_SKU.VENTUNO_Q;
  if (!totalRamBytes) return undefined;

  return totalRamBytes > RAM_THRESHOLD_BYTES
    ? PROJECT_HUB_BOARD_SKU.UNO_Q_4GB
    : PROJECT_HUB_BOARD_SKU.UNO_Q_2GB;
}

export type UsePublish = typeof usePublish;

export const usePublish = (): {
  startPublish: (app: AppDetailedInfo, includeData: boolean) => void;
  bannerProps: BannerProps | null;
} => {
  const { formatMessage } = useI18n();
  const ramTotal = useBoardResourcesStore(
    (state) => state.resources?.ram?.total,
  );
  const boardFqbn = useBoardLifecycleStore(
    (state) => state.selectedConnectedBoard?.fqbn,
  );

  const [phase, setPhase] = useState<PublishPhase | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isCurrent = useCallback(
    (abortController: AbortController): boolean =>
      abortControllerRef.current === abortController,
    [],
  );

  const {
    mutate: publish,
    variables,
    isPending,
  } = useMutation({
    mutationFn: async ({
      request,
      abortController,
    }: PublishVariables): Promise<ProjectHubDraft> => {
      const archive = await exportAppArchive(
        request.appId,
        request.includeData,
        abortController,
      );

      if (abortController.signal.aborted) {
        throw abortController.signal.reason ?? new Error('Aborted');
      }

      if (isCurrent(abortController)) {
        setPhase('uploading');
      }

      return createProjectHubDraft({
        archive,
        fileName: request.fileName,
        board: request.board,
        abortController,
      });
    },
    onSuccess: ({ draftUrl }, { abortController }) => {
      if (!isCurrent(abortController)) return;

      abortControllerRef.current = null;
      setPhase(null);

      openLinkExternal(draftUrl);
      sendAppLabNotification({
        message: formatMessage(messages.successNotification),
        variant: 'success',
        actions: [
          {
            text: formatMessage(messages.successNotificationAction),
            onClick: ({ dismiss }): void => {
              openLinkExternal(draftUrl);
              dismiss();
            },
          },
        ],
      });
    },
    onError: (_error, { request, abortController }) => {
      const { reason } = abortController.signal;
      if (reason === SUPERSEDED || !isCurrent(abortController)) return;

      abortControllerRef.current = null;
      setPhase(null);

      if (reason === USER_ABORT) {
        sendAppLabNotification({
          message: formatMessage(messages.abortedNotification),
          variant: 'success',
          duration: 3000,
        });
        return;
      }

      sendAppLabNotification({
        message: formatMessage(messages.errorNotification),
        variant: 'error',
        actions: [
          {
            text: formatMessage(messages.errorNotificationAction),
            onClick: ({ dismiss }): void => {
              dismiss();
              runPublish(request);
            },
          },
        ],
      });
    },
  });

  const runPublish = useCallback(
    (request: PublishRequest): void => {
      abortControllerRef.current?.abort(SUPERSEDED);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setPhase('exporting');
      publish({ request, abortController });
    },
    [publish],
  );

  const startPublish = useCallback(
    (app: AppDetailedInfo, includeData: boolean): void => {
      runPublish({
        appId: app.id,
        appName: [app.icon, app.name].filter(Boolean).join(' ').trim(),
        fileName: `${app.name}.zip`,
        includeData,
        board: projectHubBoardSku(boardFqbn, ramTotal),
      });
    },
    [runPublish, boardFqbn, ramTotal],
  );

  const abortPublish = useCallback((): void => {
    abortControllerRef.current?.abort(USER_ABORT);
  }, []);

  const bannerProps = useMemo((): BannerProps | null => {
    if (!isPending || !phase || !variables) return null;

    const actions: BannerAction[] = [
      {
        id: 'abort-upload',
        label: formatMessage(messages.abortAction),
        labelPrefix: <CircleSlash />,
        danger: true,
        onSelect: abortPublish,
      },
    ];

    return {
      type: 'operation',
      title: formatMessage(messages.operationTitle, {
        appName: variables.request.appName,
      }),
      description: formatMessage(messages.operationDescription),
      rows: [{ id: 'progress', label: formatMessage(phaseMessages[phase]) }],
      actions,
    };
  }, [isPending, phase, variables, formatMessage, abortPublish]);

  return {
    startPublish,
    bannerProps,
  };
};
