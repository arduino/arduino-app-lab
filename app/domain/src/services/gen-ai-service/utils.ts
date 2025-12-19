import {
  AiPromptMessage,
  HumanPromptMessage,
  Message_GenAiApi,
} from '@cloud-editor-mono/infrastructure';

import {
  AiTransmission,
  PromptResponseSubjectValue,
  TransmissionStatus,
  UserTransmission,
} from './genAiService.type';

export function addMessageToTransmission(
  prompt: Partial<UserTransmission>,
  msg: HumanPromptMessage,
  status: TransmissionStatus,
): UserTransmission;
export function addMessageToTransmission(
  prompt: Partial<AiTransmission>,
  msg: AiPromptMessage,
  status: TransmissionStatus,
): AiTransmission;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function addMessageToTransmission(
  prompt: Partial<UserTransmission> | Partial<AiTransmission>,
  msg: Message_GenAiApi,
  status: TransmissionStatus,
) {
  return {
    ...prompt,
    messages: [
      ...(prompt.messages || []),
      {
        id: msg.id,
        ts: msg.timestamp,
        status,
        content: msg.content,
        initiatingMessageId: msg.initiatingMessageId,
        retrievedDocuments: msg.retrievedDocuments,
      },
    ],
  };
}

export function createNewTransmission(
  msg: HumanPromptMessage,
  status: TransmissionStatus,
): UserTransmission;
export function createNewTransmission(
  msg: AiPromptMessage,
  status: TransmissionStatus,
): AiTransmission;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createNewTransmission(
  msg: Message_GenAiApi,
  status: TransmissionStatus,
) {
  return {
    type: msg.type,
    messages: [
      {
        id: msg.id,
        timestamp: msg.timestamp,
        status,
        content: msg.content,
        initiatingMessageId: msg.initiatingMessageId,
        tag: msg.tag,
        retrievedDocuments: msg.retrievedDocuments,
      },
    ],
  };
}

export function shouldAddPrompt(
  isLastItem: boolean,
  nextMsg?: Message_GenAiApi,
): boolean {
  return isLastItem || !!(nextMsg && !nextMsg.type?.includes('user:'));
}

export function addResponseToSubjectValue(
  subjectValue: PromptResponseSubjectValue,
  subjectValueId: string,
  response: AiTransmission,
): PromptResponseSubjectValue {
  return subjectValue.map((item) => {
    if (item.id === subjectValueId) {
      return { ...item, response };
    }

    return item;
  });
}

export function replaceResponseInSubjectValue(
  subjectValue: PromptResponseSubjectValue,
  promptMessageId: string,
  response: AiTransmission,
): PromptResponseSubjectValue {
  return subjectValue.map((item) => {
    if (
      item.response?.messages.find(
        (msg) => msg.initiatingMessageId === promptMessageId,
      )
    ) {
      return { ...item, response };
    }

    return item;
  });
}

export function updateMessageStatus(
  subjectValue: PromptResponseSubjectValue,
  subjectValueId: string,
  msgId: string,
  status: TransmissionStatus,
): PromptResponseSubjectValue {
  return subjectValue.map((item) => {
    if (item.id === subjectValueId) {
      const messages =
        item.prompt?.messages.map((msg) => {
          if (msg.id === msgId) {
            return { ...msg, status };
          }

          return msg;
        }) || [];

      return {
        ...item,
        prompt: item.prompt ? { ...item.prompt, messages } : undefined,
      };
    }

    return item;
  });
}
