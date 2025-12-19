import {
  AiPromptMessage,
  ConversationResponse_GenAiApi,
  NewConversationResponse_GenAiApi,
  NewMessageResponse_GenAiApi,
} from './genAiApi.type';

export function mapGenAINewConversationResponse(
  data: NewConversationResponse_GenAiApi,
): NewConversationResponse_GenAiApi {
  return data;
}

export function mapGenAINewMessageResponse(
  data: NewMessageResponse_GenAiApi,
): AiPromptMessage {
  data.initiatingMessageId;
  const message = {
    ...data.message,
    initiatingMessageId: data.initiatingMessageId,
  };
  return message as AiPromptMessage;
}

export function mapGenAIConversationResponse(
  data: ConversationResponse_GenAiApi,
): ConversationResponse_GenAiApi {
  return data;
}
