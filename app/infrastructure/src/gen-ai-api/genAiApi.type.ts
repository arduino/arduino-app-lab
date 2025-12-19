import { components } from './gen-ai-api';

export type HumanContent_GenAiApi = components['schemas']['HumanContent'];

export type AssistantContent_GenAiApi =
  components['schemas']['AssistantContent'];

export enum TransmissionTag {
  PlanRequest = 'sketch-plan/request',
  PlanResponse = 'sketch-plan/response',
  GeneratedSketch = 'sketch-plan/generated-sketch',
  ErrorFixRequest = 'error-fix/request',
  ErrorFixResponse = 'error-fix/response',
}

export interface GenAIContentComponent {
  data: string;
  type: 'text' | 'code' | 'diff';
  tag?: TransmissionTag;
  boardName?: string;
  errorFiles?: string[];
}

export type Message_GenAiApi = components['schemas']['Message'] & {
  initiatingMessageId?: string;
};

export type GenAIContentProp = Message_GenAiApi['content'];
export type GenAIMessageSenderType = Message_GenAiApi['type'];

export type AiPromptMessage = Omit<Message_GenAiApi, 'type' | 'content'> & {
  type: 'assistant';
  content: AssistantContent_GenAiApi;
};

export type HumanPromptMessage = Omit<Message_GenAiApi, 'type' | 'content'> & {
  type: 'human';
  content: HumanContent_GenAiApi;
};

export type GenAIPromptMessage = AiPromptMessage | HumanPromptMessage;

export type NewConversationResponse_GenAiApi =
  components['schemas']['NewConversationResponse'];

export type ConversationResponse_GenAiApi = Omit<
  components['schemas']['ConversationResponse'],
  'history'
> & {
  history: GenAIPromptMessage[];
};

export type NewMessageRequest_GenAiApi =
  components['schemas']['NewMessageRequest'];

export type NewMessageResponse_GenAiApi =
  components['schemas']['NewMessageResponse'];

export type SketchPlan_GenAiApi = components['schemas']['SketchPlan'];

export type GeneratedSketch_GenAiApi = components['schemas']['GeneratedSketch'];

export enum SourceType {
  Sketches = 'sketches',
  Examples = 'examples',
  Libraries = 'libraries',
}

export enum RetrievedDocumentType {
  Tutorial = 'tutorial',
  Example = 'example',
  TechReference = 'tech-reference',
}

export type RetrievedDocument = {
  title?: string;
  url: string;
  type: RetrievedDocumentType;
};
