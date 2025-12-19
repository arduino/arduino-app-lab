import {
  addMessageToConversation,
  clearConversation,
  DEFAULT_SKETCH_PLAN_BOARD,
  ga4Emitter,
  getConversationObservable,
  NotificationMode,
  PromptResponseSubjectValue,
  sendAnalyticsEvent,
  sendNotification,
  sendSketchPlanResponse,
  SketchPlanActionType,
  startConversation,
} from '@cloud-editor-mono/domain';
import {
  AssistantContent_GenAiApi,
  GenAIContentComponent,
  HumanContent_GenAiApi,
  SourceType,
  TransmissionTag,
} from '@cloud-editor-mono/infrastructure';
import {
  GenAIConversation,
  SidenavItemId,
  ToastSize,
  ToastType,
  useI18n,
} from '@cloud-editor-mono/ui-components';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useNavigate, useSearch } from '@tanstack/react-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { uniqueId } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useIsExampleRoute,
  useIsLibraryRoute,
  useSketchParams,
} from '../../../cloud-editor/features/main/hooks/sketch';
import { NAV_PARAM, SearchGenerics } from '../../../routing/routing.type';
import { queryClient } from '../../providers/data-fetching/QueryProvider';
import { useObservable } from '../useObservable';
import {
  genAIResponseIsPromptToLongError,
  genAIResponseMaxTokensReachedError,
  isGenAIResponseContentTypeStream,
} from './genAIUtils';
import { messages } from './messages';

type UseSourceParams = () => {
  sourceId: string;
  sourceType: SourceType;
};

type UseGenAIChat = (
  enabled: boolean,
  selectedBoard?: string,
  boardName?: string,
  errorFiles?: string[],
) => {
  conversation: GenAIConversation;
  conversationIsLoading: boolean;
  promptResponseIsLoading: boolean;
  stopGeneration: () => void;
  sendTextMessage: (text: string, tag?: TransmissionTag) => void;
  sketchPlanAction: (sketchPlanPayload: {
    promptMessageId?: string;
    assistantMessageTs?: string;
    actionType: SketchPlanActionType;
  }) => void;
  sketchPlanActionIsLoading: boolean;
  isSketchPlan: boolean;
  isStreamSending: boolean;
  actionType?: SketchPlanActionType;
  onCopyCode: () => void;
};

type UseClearChat = () => {
  isConversationEmpty: boolean;
  clearChatConfirm: () => void;
  clearChat: () => void;
  restoreChat: () => void;
  isClearChatNotificationOpen: boolean;
};

export function isAssistantContent(
  content?: HumanContent_GenAiApi | AssistantContent_GenAiApi,
): content is AssistantContent_GenAiApi {
  return (
    Array.isArray(content) &&
    content.every((c) => c.data !== undefined && c.type !== undefined)
  );
}

const userDisplayName = 'User';
const aiDisplayName = 'Arduino AI Assistant';

const useSourceParams: UseSourceParams = function () {
  const { sketchID, exampleID, libraryID } = useSketchParams();
  const isExampleRoute = useIsExampleRoute();
  const isLibraryRoute = useIsLibraryRoute();

  return {
    sourceId: encodeURIComponent(
      (isExampleRoute ? exampleID : isLibraryRoute ? libraryID : sketchID) ??
        '',
    ),
    sourceType: isExampleRoute
      ? SourceType.Examples
      : isLibraryRoute
      ? SourceType.Libraries
      : SourceType.Sketches,
  };
};

export const useGenAIChat: UseGenAIChat = function (
  enabled: boolean,
  selectedBoard?: string,
  boardName?: string,
  errorFiles?: string[],
) {
  const { formatMessage } = useI18n();

  const navigate = useNavigate();
  const search = useSearch<SearchGenerics>();

  const queryClient = useQueryClient();

  const abortController = useRef<AbortController>();
  const [conversation, setConversation] = useState<GenAIConversation>([]);
  const [isSketchPlan, setIsSketchPlan] = useState(false);
  const [isStreamSending, setIsStreamSending] = useState(false);

  const { sourceId, sourceType } = useSourceParams();

  const { isFetching: conversationIsLoading } = useQuery(
    ['start-gen-ai-chat'],
    () => startConversation(sourceId, sourceType),
    {
      enabled,
    },
  );

  const [longPromptToastId, setLongPromptToastId] = useState<string>();

  const streamHandlers = {
    onopen: async (response: Response): Promise<void> => {
      if (!isGenAIResponseContentTypeStream(response)) {
        const promptIsTooLong = await genAIResponseIsPromptToLongError(
          response,
        );

        if (promptIsTooLong) {
          if (longPromptToastId) return;
          const toastId = uniqueId();
          sendNotification({
            mode: NotificationMode.Toast,
            modeOptions: {
              toastId,
              toastType: ToastType.Passive,
              toastSize: ToastSize.Small,
              onUnmount: (): void => {
                setLongPromptToastId(undefined);
              },
            },
            message: formatMessage(messages.genAIPromptToLongError),
          });

          setLongPromptToastId(toastId);

          abortController.current?.abort();
          reset();
        }
      }
    },
    onerror: (): void => {
      setIsStreamSending(false);

      abortController.current?.abort();
      reset();
    },
    onmessage: (message: EventSourceMessage): void => {
      if (genAIResponseMaxTokensReachedError(message)) {
        sendNotification({
          mode: NotificationMode.Toast,
          modeOptions: {
            toastType: ToastType.Passive,
            toastSize: ToastSize.Small,
          },
          message: formatMessage(messages.genAIMaxTokensReachedError),
        });
        return;
      }
      setIsStreamSending(
        message.event === 'message' || message.event === 'assistantMessageEnd',
      );
    },
    onclose: (): void => {
      setIsStreamSending(false);
    },
  };

  const {
    isLoading: promptResponseIsLoading,
    mutate: sendPrompt,
    reset,
  } = useMutation(['send-prompt'], {
    mutationFn: (payload: GenAIContentComponent) => {
      navigate({ search: { ...search, [NAV_PARAM]: SidenavItemId.GenAI } });
      return addMessageToConversation(
        sourceId,
        sourceType,
        payload,
        streamHandlers,
        undefined,
        abortController.current,
      );
    },
    onMutate: () => {
      abortController.current = new AbortController();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['user-restrictions-recap'], {
        exact: false,
      });
      const action =
        variables.tag === TransmissionTag.PlanRequest
          ? 'sketch generation template submitted'
          : 'question submitted';

      ga4Emitter({
        type: 'GEN_AI_INTERACTION',
        payload: {
          action,
        },
      });

      const category =
        variables.tag === TransmissionTag.PlanRequest
          ? 'ai-interaction'
          : 'ai-question submitted';

      sendAnalyticsEvent({
        data: {
          category,
          action,
          'question-submitted': variables.data,
        },
      });
    },
  });

  const stopGeneration = useCallback(() => {
    abortController.current?.abort();
    reset();
  }, [reset]);

  const {
    mutate: sketchPlanAction,
    isLoading: sketchPlanActionIsLoading,
    variables: sketchPlanVariables,
  } = useMutation(['sketch-plan-response'], sendSketchPlanResponse, {
    onSuccess: (_, variables) => {
      if (variables.actionType === SketchPlanActionType.ConfirmSketchPlan) {
        ga4Emitter({
          type: 'GEN_AI_INTERACTION',
          payload: {
            action: 'sketch confirmed',
          },
        });
        sendAnalyticsEvent({
          data: {
            category: 'ai-interaction',
            action: 'sketch confirmed',
          },
        });
      }
    },
  });

  const conversationSubject$ = getConversationObservable();
  const subjectIsSubbed = useRef(false);

  useEffect(() => {
    if (subjectIsSubbed.current) {
      return;
    }

    const sub = conversationSubject$.subscribe((pairwiseConversation) => {
      const _conversation: GenAIConversation = [];
      if (pairwiseConversation) {
        for (const { id, prompt, response } of pairwiseConversation) {
          if (prompt) {
            for (const message of prompt.messages) {
              _conversation.push({
                id: message.id,
                data: message.content,
                createdAt: new Date(message.timestamp),
                senderDisplayName: userDisplayName,
                status: message.status,
                metadata: { custom: { ...message } },
                retrievedDocuments: message.retrievedDocuments,
                role: 'user',
                content: [],
                attachments: [],
              });
            }
          }
          if (response) {
            for (const message of response.messages) {
              _conversation.push({
                id,
                data: message.content,
                createdAt: new Date(message.timestamp),
                senderDisplayName: aiDisplayName,
                status: message.status,
                retrievedDocuments: message.retrievedDocuments,
                tag: message.tag,
                initiatingMessageId: message.initiatingMessageId,
                metadata: {
                  custom: { ...message },
                  steps: [],
                  unstable_annotations: [],
                  unstable_data: [],
                },
                role: 'assistant',
                content: [],
                attachments: [],
              });
            }
          }
        }
      }
      const lastMessage = _conversation[_conversation.length - 1];
      setIsSketchPlan(
        lastMessage &&
          isAssistantContent(lastMessage.data) &&
          lastMessage.data[0].type === 'sketch-plan',
      );

      setConversation(_conversation);
    });

    subjectIsSubbed.current = true;

    return () => {
      sub.unsubscribe();
      subjectIsSubbed.current = false;
    };
  }, [conversationSubject$]);

  const sendTextMessage = useCallback(
    (text: string, tag?: TransmissionTag) => {
      sendPrompt({
        data: text,
        type: 'text',
        tag,
        boardName:
          boardName ??
          (tag === TransmissionTag.PlanRequest
            ? DEFAULT_SKETCH_PLAN_BOARD
            : undefined),
        errorFiles,
      });
    },
    [errorFiles, boardName, sendPrompt],
  );

  const onCopyCode = useCallback(() => {
    ga4Emitter({
      type: 'GEN_AI_INTERACTION',
      payload: {
        action: 'sketch copied',
      },
    });
    sendAnalyticsEvent({
      data: {
        category: 'ai-interaction',
        action: 'sketch copied',
      },
    });
  }, []);

  return {
    conversation,
    conversationIsLoading:
      conversationIsLoading || (!!selectedBoard && boardName === undefined),
    promptResponseIsLoading,
    sendTextMessage,
    stopGeneration,
    sketchPlanAction,
    sketchPlanActionIsLoading,
    isSketchPlan,
    isStreamSending,
    actionType: sketchPlanVariables?.actionType,
    onCopyCode,
  };
};

export const useClearChat: UseClearChat = function () {
  const [conversation, setConversation] = useState<PromptResponseSubjectValue>(
    [],
  );
  const [isClearChatNotificationOpen, setIsClearChatNotificationOpen] =
    useState(false);
  const conversationSubject$ = getConversationObservable();
  const currentValue = useObservable(conversationSubject$);

  const { sourceId, sourceType } = useSourceParams();

  const { mutate: clearChatConfirm } = useMutation(
    ['clear-chat'],
    () => {
      if (!isClearChatNotificationOpen) {
        return Promise.resolve(null);
      }
      setIsClearChatNotificationOpen(false);
      return clearConversation(sourceId, sourceType);
    },
    {
      onSuccess: () => {
        ga4Emitter({
          type: 'GEN_AI_INTERACTION',
          payload: {
            action: 'chat deleted',
          },
        });
        sendAnalyticsEvent({
          data: {
            category: 'ai-interaction',
            action: 'chat deleted',
          },
        });
      },
    },
  );

  const clearChat = useCallback(() => {
    setIsClearChatNotificationOpen(true);
    if (currentValue) {
      setConversation(currentValue);
    }
    conversationSubject$.next([]);
  }, [conversationSubject$, currentValue]);

  const restoreChat = useCallback(() => {
    setIsClearChatNotificationOpen(false);
    conversationSubject$.next(conversation);
  }, [conversation, conversationSubject$]);

  return {
    isConversationEmpty: currentValue?.length === 0,
    clearChatConfirm,
    clearChat,
    restoreChat,
    isClearChatNotificationOpen,
  };
};

const GEN_AI_DISCLAIMER_KEY = 'arduino:gen-ai-legal-disclaimer';

export const useGenAiLegalDisclaimer = (): ReturnType<
  () => {
    acceptLegalDisclaimer: () => void;
    isLegalDisclaimerAccepted: boolean;
  }
> => {
  const { mutate: acceptLegalDisclaimer } = useMutation({
    mutationFn: () => {
      return set(GEN_AI_DISCLAIMER_KEY, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([GEN_AI_DISCLAIMER_KEY]);
    },
  });

  const { data: isLegalDisclaimerAccepted, isLoading } = useQuery(
    [GEN_AI_DISCLAIMER_KEY],
    async () => {
      const data = (await get(GEN_AI_DISCLAIMER_KEY)) ?? false;
      return data;
    },
    {
      refetchOnWindowFocus: false,
    },
  );

  return {
    acceptLegalDisclaimer,
    isLegalDisclaimerAccepted: isLoading
      ? true
      : isLegalDisclaimerAccepted ?? false,
  };
};
