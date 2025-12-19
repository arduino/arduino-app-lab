import { MessageStatus } from '@assistant-ui/react';
import {
  AiPromptMessage,
  HumanPromptMessage,
  RetrievedDocument,
  TransmissionTag,
} from '@cloud-editor-mono/infrastructure';
import { BehaviorSubject } from 'rxjs';

export type TransmissionStatus = MessageStatus;

type AiTransmissionMessage = {
  id: string;
  status: TransmissionStatus;
  initiatingMessageId: string;
  tag: TransmissionTag;
  retrievedDocuments: RetrievedDocument[];
} & Pick<AiPromptMessage, 'timestamp' | 'content'>;
export interface AiTransmission {
  type: 'assistant';
  messages: AiTransmissionMessage[];
}

type UserTransmissionMessage = {
  id: string;
  status: TransmissionStatus;
  initiatingMessageId: string;
  tag: TransmissionTag;
  retrievedDocuments: RetrievedDocument[];
} & Pick<HumanPromptMessage, 'timestamp' | 'content'>;

export interface UserTransmission {
  type: 'human';
  messages: UserTransmissionMessage[];
}

export function isCompleteTransmission<
  T extends AiTransmission | UserTransmission,
>(obj: Partial<T>): obj is T {
  return obj.messages !== undefined && obj.type !== undefined;
}
export interface PromptResponsePair {
  id: string;
  prompt?: UserTransmission;
  response?: AiTransmission;
}

export type PromptResponseSubjectValue = PromptResponsePair[];

export type PromptResponseSubject = BehaviorSubject<PromptResponseSubjectValue>;

export interface GenAIServiceState {
  promptResponseSubject$?: PromptResponseSubject;
  initialized?: boolean;
  isExchangeInProgress?: boolean;
}

export enum SketchPlanActionType {
  ConfirmSketchPlan = 'confirmSketchPlan',
  RefreshSketchPlan = 'refreshSketchPlan',
  CancelSketchPlan = 'cancelSketchPlan',
}

export const DEFAULT_SKETCH_PLAN_BOARD = 'Arduino Uno';
