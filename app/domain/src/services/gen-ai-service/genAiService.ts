import {
  AiPromptMessage,
  ConversationResponse_GenAiApi,
  EventSourceHandlers,
  GenAIContentComponent,
  genAICreateConversationV2Request,
  genAIDeleteConversationV2Request,
  genAIGetConversationV2Request,
  genAISendMessageStreamGenericRequest,
  genAISketchPlanConfirmRequest,
  genAISketchPlanDeleteRequest,
  genAISketchPlanRefreshRequest,
  NewMessageRequest_GenAiApi,
  ORGANIZATION_HEADER,
  SourceType,
} from '@cloud-editor-mono/infrastructure';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import { uniqueId } from 'lodash';
import { BehaviorSubject } from 'rxjs';
import { WretchError } from 'wretch/types';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { getSpace } from '../space-storage';
import {
  AiTransmission,
  GenAIServiceState,
  isCompleteTransmission,
  PromptResponsePair,
  PromptResponseSubject,
  PromptResponseSubjectValue,
  SketchPlanActionType,
  UserTransmission,
} from './genAiService.type';
import {
  addMessageToTransmission,
  addResponseToSubjectValue,
  createNewTransmission,
  replaceResponseInSubjectValue,
  shouldAddPrompt,
  updateMessageStatus,
} from './utils';

let genAIServiceState: GenAIServiceState = {};

export function resetGenAIServiceState(): void {
  genAIServiceState = {};
}

function createGenAIServiceState(
  currentState: GenAIServiceState,
  newStateProps: Partial<GenAIServiceState>,
): GenAIServiceState {
  return {
    ...currentState,
    ...newStateProps,
  };
}

function setGenAIServiceState(newStateProps: Partial<GenAIServiceState>): void {
  genAIServiceState = createGenAIServiceState(genAIServiceState, newStateProps);
}

function instantiatePromptResponseSubject(): PromptResponseSubject {
  const promptResponseSubject$ =
    new BehaviorSubject<PromptResponseSubjectValue>([]);
  setGenAIServiceState({
    promptResponseSubject$,
  });

  return promptResponseSubject$;
}

export function getConversationObservable(): PromptResponseSubject {
  const { promptResponseSubject$ } = genAIServiceState;

  return promptResponseSubject$ || instantiatePromptResponseSubject();
}

export async function getGenAIMessages(
  sourceId: string,
  sourceType: SourceType,
): Promise<ConversationResponse_GenAiApi> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space
    ? {
        [ORGANIZATION_HEADER]: space,
      }
    : undefined;

  await genAICreateConversationV2Request(sourceId, sourceType, token, headers);

  return genAIGetConversationV2Request(sourceId, sourceType, token, headers);
}

export async function sendGenAIStreamPrompt(
  sourceId: string,
  sourceType: SourceType,
  handlers: EventSourceHandlers,
  message?: NewMessageRequest_GenAiApi,
  messageId?: string,
  abortController?: AbortController,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space ? { [ORGANIZATION_HEADER]: space } : undefined;

  return genAISendMessageStreamGenericRequest(
    sourceId,
    sourceType,
    handlers,
    token,
    message,
    messageId,
    abortController,
    headers,
  );
}

export async function startConversation(
  sourceId: string,
  sourceType: SourceType,
): Promise<PromptResponseSubjectValue> {
  if (genAIServiceState.isExchangeInProgress) {
    throw new Error(
      'Cannot reinitialize conversation while exchange is in progress',
    );
  }

  resetGenAIServiceState();

  const result = await getGenAIMessages(sourceId, sourceType);

  let subjectValue: PromptResponseSubjectValue = [];
  if (result.history.length > 0) {
    const orderedMessages = result.history.sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp),
    );

    let subjectValueItem = {};
    let prompt: Partial<UserTransmission> = { messages: [] };
    let response: Partial<AiTransmission> = { messages: [] };
    const resetVariables = (): void => {
      subjectValueItem = {};
      prompt = { messages: [] };
      response = { messages: [] };
    };

    orderedMessages.forEach((msg, index, array) => {
      const isLastItem = index === array.length - 1;
      const nextMsg = array[index + 1];

      const isUserMessage = msg.type === 'human';
      const isAiMessage = msg.type === 'assistant';

      if (isUserMessage) {
        prompt =
          (prompt.messages?.length ?? 0) > 0
            ? addMessageToTransmission(prompt, msg, {
                type: 'complete',
                reason: 'unknown',
              })
            : createNewTransmission(msg, {
                type: 'complete',
                reason: 'unknown',
              });

        if (
          shouldAddPrompt(isLastItem, nextMsg) &&
          isCompleteTransmission(prompt)
        ) {
          subjectValueItem = {
            id: uniqueId(),
            prompt,
          };

          if (isLastItem) {
            subjectValue.push(subjectValueItem as PromptResponsePair);
            resetVariables();
          }
        }

        return;
      }

      if (isAiMessage) {
        const msgWithSourceID = prompt.messages
          ? {
              ...msg,
              initiatingMessageId:
                prompt.messages.length > 0 ? prompt.messages[0].id : uniqueId(),
            }
          : msg;

        response =
          (response.messages?.length ?? 0) > 0
            ? addMessageToTransmission(response, msgWithSourceID, {
                type: 'complete',
                reason: 'unknown',
              })
            : createNewTransmission(msgWithSourceID, {
                type: 'complete',
                reason: 'unknown',
              });

        if (
          shouldAddPrompt(isLastItem, nextMsg) &&
          isCompleteTransmission(response)
        ) {
          subjectValueItem = {
            ...(subjectValueItem ?? { id: uniqueId() }),
            response,
          };

          subjectValue.push(subjectValueItem as PromptResponsePair);
          resetVariables();
        }
      }
    });
  } else {
    subjectValue = [];
  }

  const subject$ = getConversationObservable();

  subject$.next(subjectValue);

  setGenAIServiceState({
    initialized: true,
  });

  return subjectValue;
}

export async function addMessageToConversation(
  sourceId: string,
  sourceType: SourceType,
  msg: GenAIContentComponent,
  handlers: EventSourceHandlers,
  messageId?: string,
  abortController?: AbortController,
): Promise<void> {
  if (!genAIServiceState.initialized) {
    throw new Error('Conversation not initialized');
  }

  if (genAIServiceState.isExchangeInProgress) {
    throw new Error('An exchange is already in progress');
  }

  setGenAIServiceState({
    isExchangeInProgress: true,
  });

  const subject$ = getConversationObservable();
  const currentValue = subject$.getValue();

  const msgId = uniqueId();
  const subjectValueId = uniqueId();

  if (!messageId) {
    const prompt = createNewTransmission(
      {
        timestamp: new Date().toISOString(),
        type: 'human',
        content: {
          text: msg.data,
        },
        id: msgId,
      },
      {
        type: 'running',
      },
    );

    subject$.next([...currentValue, { id: subjectValueId, prompt }]);
  }

  try {
    const onmessage: EventSourceHandlers['onmessage'] = (message) => {
      if (
        message.event !== 'message' &&
        message.event !== 'assistantMessageEnd'
      ) {
        return;
      }

      const data = JSON.parse(message.data);

      const updatedValue = updateMessageStatus(
        subject$.getValue(),
        subjectValueId,
        msgId,
        {
          type: 'complete',
          reason: 'unknown',
        },
      );

      const msg: AiPromptMessage =
        message.event === 'assistantMessageEnd'
          ? {
              ...data.message,
              initiatingMessageId: data.initiatingMessageId,
            }
          : {
              timestamp: new Date().toISOString(),
              type: 'assistant',
              content: data,
              id: '',
            };

      const response = createNewTransmission(msg, {
        type: 'complete',
        reason: 'unknown',
      });

      const updatedValueWithResponse = messageId
        ? replaceResponseInSubjectValue(currentValue, messageId, response)
        : addResponseToSubjectValue(updatedValue, subjectValueId, response);

      subject$.next(updatedValueWithResponse);
    };
    try {
      await sendGenAIStreamPrompt(
        sourceId,
        sourceType,
        {
          ...handlers,
          onmessage: (message: EventSourceMessage) => {
            handlers.onmessage?.(message);
            onmessage(message);
          },
        },
        {
          type: 'human',
          content: {
            text: msg.data,
            meta: {
              board: msg.boardName,
              errorFiles: msg.errorFiles,
            },
          },
          tag: msg.tag,
        },
        messageId,
        abortController,
      );
    } catch (err: unknown) {
      if ((err as WretchError).status === 404) {
        throw new Error('Conversation expired');
      } else {
        throw err;
      }
    }
  } catch {
    if (abortController?.signal.aborted) {
      subject$.next(currentValue);
      return;
    }

    const updatedValue = updateMessageStatus(
      subject$.getValue(),
      subjectValueId,
      msgId,
      {
        type: 'incomplete',
        reason: 'error',
      },
    );

    subject$.next(updatedValue);
  } finally {
    setGenAIServiceState({
      isExchangeInProgress: false,
    });
  }
}

export async function clearConversation(
  sourceId: string,
  sourceType: SourceType,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space
    ? {
        [ORGANIZATION_HEADER]: space,
      }
    : undefined;

  await genAIDeleteConversationV2Request(sourceId, sourceType, token, headers);

  await genAICreateConversationV2Request(sourceId, sourceType, token, headers);

  return;
}

export async function cancelSketchPlan(
  promptMessageId: string,
  assistantMessageTs: string,
  currentValue: PromptResponseSubjectValue,
  subject$: PromptResponseSubject,
  token: string,
  headers?: HeadersInit,
): Promise<void> {
  const updatedValue = currentValue.filter(({ response }) =>
    response?.messages.find(({ id }) => id !== assistantMessageTs),
  );

  const idsToRemove = [assistantMessageTs, promptMessageId];

  try {
    await Promise.all(
      idsToRemove.map((id) => genAISketchPlanDeleteRequest(id, token, headers)),
    );

    subject$.next(updatedValue);
  } catch (err: unknown) {
    subject$.next(currentValue);
  } finally {
    setGenAIServiceState({
      isExchangeInProgress: false,
    });
  }

  return;
}

export async function sendSketchPlanResponse(payload: {
  promptMessageId?: string;
  assistantMessageTs?: string;
  actionType: SketchPlanActionType;
}): Promise<void> {
  const { assistantMessageTs, promptMessageId, actionType } = payload;

  if (!genAIServiceState.initialized) {
    throw new Error('Conversation not initialized');
  }

  if (genAIServiceState.isExchangeInProgress) {
    throw new Error('An exchange is already in progress');
  }

  if (!assistantMessageTs || !promptMessageId) {
    throw new Error('Message ID is required');
  }

  setGenAIServiceState({
    isExchangeInProgress: true,
  });

  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space
    ? {
        [ORGANIZATION_HEADER]: space,
      }
    : undefined;

  const subject$ = getConversationObservable();
  const currentValue = subject$.getValue();

  if (actionType === SketchPlanActionType.CancelSketchPlan) {
    await cancelSketchPlan(
      promptMessageId,
      assistantMessageTs,
      currentValue,
      subject$,
      token,
      headers,
    );

    return;
  }

  let result: AiPromptMessage;
  try {
    if (actionType === SketchPlanActionType.RefreshSketchPlan) {
      result = await genAISketchPlanRefreshRequest(
        promptMessageId,
        token,
        headers,
      );
    } else {
      result = await genAISketchPlanConfirmRequest(
        {
          sketchPlanId: assistantMessageTs,
        },
        token,
        headers,
      );
    }

    const response = createNewTransmission(result, {
      type: 'complete',
      reason: 'unknown',
    });

    const updatedValueWithResponse =
      actionType === SketchPlanActionType.RefreshSketchPlan
        ? replaceResponseInSubjectValue(currentValue, promptMessageId, response)
        : [...currentValue, { id: uniqueId(), response }];

    subject$.next(updatedValueWithResponse);
  } catch (err: unknown) {
    subject$.next(currentValue);
  } finally {
    setGenAIServiceState({
      isExchangeInProgress: false,
    });
  }
}
