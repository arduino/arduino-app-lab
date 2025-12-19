import { Config } from '@cloud-editor-mono/common';
import { FetchEventSourceInit } from '@microsoft/fetch-event-source';

import { httpDelete, httpGet, httpPost } from '../fetch/fetch';
import { EventSourceHandlers, postEventSource } from '../fetch-event-source';
import {
  AiPromptMessage,
  ConversationResponse_GenAiApi,
  NewConversationResponse_GenAiApi,
  NewMessageRequest_GenAiApi,
  NewMessageResponse_GenAiApi,
  SourceType,
} from './genAiApi.type';
import {
  mapGenAIConversationResponse,
  mapGenAINewConversationResponse,
  mapGenAINewMessageResponse,
} from './mapper';

export async function genAISketchPlanConfirmRequest(
  message: {
    sketchPlanId: string;
  },
  token: string,
  headers?: HeadersInit,
): Promise<AiPromptMessage> {
  const endpoint = `/v1/conversation/sketches`;

  const response = await httpPost<NewMessageResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    message,
    token,
    undefined,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGenAINewMessageResponse(response);
}

export async function genAISketchPlanDeleteRequest(
  sourceMessageTs: string,
  token: string,
  headers?: HeadersInit,
): Promise<void> {
  const endpoint = `/v1/conversation/messages/${sourceMessageTs}`;

  await httpDelete<ConversationResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    token,
    headers,
  );
}

export async function genAISketchPlanRefreshRequest(
  sourceMessageTs: string,
  token: string,
  headers?: HeadersInit,
): Promise<AiPromptMessage> {
  const endpoint = `/v1/conversation/messages/${sourceMessageTs}`;

  const response = await httpPost<NewMessageResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    undefined,
    token,
    undefined,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGenAINewMessageResponse(response);
}

export async function genAIGetConversationV2Request(
  sourceId: string,
  sourceType: SourceType,
  token: string,
  headers?: HeadersInit,
): Promise<ConversationResponse_GenAiApi> {
  const endpoint = `/v2/${sourceType}/${sourceId}/conversation`;

  const response = await httpGet<ConversationResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGenAIConversationResponse(response);
}

export async function genAIDeleteConversationV2Request(
  sourceId: string,
  sourceType: SourceType,
  token: string,
  headers?: HeadersInit,
): Promise<void> {
  const endpoint = `/v2/${sourceType}/${sourceId}/conversation`;

  await httpDelete<ConversationResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    token,
    headers,
  );
}

export async function genAICreateConversationV2Request(
  sourceId: string,
  sourceType: SourceType,
  token: string,
  headers?: HeadersInit,
): Promise<NewConversationResponse_GenAiApi> {
  const endpoint = `/v2/${sourceType}/${sourceId}/conversation`;

  const response = await httpPost<NewConversationResponse_GenAiApi>(
    Config.GEN_AI_API_URL,
    undefined,
    endpoint,
    undefined,
    token,
    undefined,
    headers,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGenAINewConversationResponse(response);
}

export async function genAISendMessageStreamGenericRequest(
  sourceId: string,
  sourceType: SourceType,
  handlers: EventSourceHandlers,
  token: string,
  message?: NewMessageRequest_GenAiApi,
  messageId?: string,
  abortController?: AbortController,
  headers?: FetchEventSourceInit['headers'],
): Promise<void> {
  const endpoint = `/v2/${sourceType}/${sourceId}/conversation/messages`;
  const sseUrl = `${Config.GEN_AI_API_URL}${endpoint}`;

  return postEventSource(
    messageId ? `${sseUrl}/${messageId}` : sseUrl,
    handlers,
    message,
    token,
    abortController,
    headers,
  );
}
