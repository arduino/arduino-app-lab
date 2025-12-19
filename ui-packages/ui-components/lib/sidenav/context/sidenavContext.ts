import {
  GetFilesList_Response,
  TransmissionTag,
} from '@cloud-editor-mono/infrastructure';
import { PressEvent } from '@react-aria/interactions';
import { PressEvents } from '@react-types/shared';
import { createContext } from 'react';

import {
  CustomLibraryExampleItem,
  Example,
  ExamplesFolder,
  ExamplesMenuHandlerDictionary,
  GenAIConversation,
  GetCustomLibrary,
  GetExampleFileContents,
  GetExampleLinkSearch,
  GetLibraries,
  GetLibrary,
  SketchPlanActionType,
  SurveyType,
} from '../sidenav.type';

export type SidenavContextValue = {
  getLibraries: GetLibraries;
  getLibrary: GetLibrary;
  getCustomLibrary: GetCustomLibrary;
  getCurrentResourceIds: () => {
    exampleID?: string;
    sourceLibraryID?: string;
    customLibraryID?: string;
  };
  isExampleSketchContext: () => boolean;
  getExampleLinkSearch: GetExampleLinkSearch;
  onExampleLinkInteract: PressEvents['onPress'];
  exampleLinkToPath: string;
  examplesMenuHandlers: ExamplesMenuHandlerDictionary;
  getExampleFileContents: GetExampleFileContents;
  getExamplesByFolder: (examples: Example[]) => ExamplesFolder[];
  getCustomLibraryExamplesByFolder: (
    examples: GetFilesList_Response,
  ) => CustomLibraryExampleItem[];
  bypassOrgHeader: boolean;
  onPrivateResourceRequestError?: (error: unknown) => void;
  currentSidenavPanelWidth: number;
  clearChatConfirm: () => void;
  clearChat: () => void;
  restoreChat: () => void;
  isConversationEmpty: boolean;
  isClearChatNotificationOpen: boolean;
  showMoreInfoLinks: boolean;
  history: GenAIConversation;
  sendMessage: (text: string, tag?: TransmissionTag) => void;
  isLoading: boolean;
  isSending: boolean;
  triggerSurvey: (
    event: PressEvent,
    type: SurveyType,
    chatHistory: string,
  ) => void;
  stopGeneration: () => void;
  sketchPlanAction: (sketchPlanPayload: {
    promptMessageId?: string;
    assistantMessageTs?: string;
    actionType: SketchPlanActionType;
  }) => void;
  sketchPlanActionIsLoading: boolean;
  isSketchPlan: boolean;
  isStreamSending: boolean;
  actionType?: SketchPlanActionType;
  onCopyCode?: (code: string) => void;
  isLegalDisclaimerAccepted: boolean;
  acceptLegalDisclaimer: () => void;
};

const sidenavContextValue: SidenavContextValue = {} as SidenavContextValue;

export const SidenavContext =
  createContext<SidenavContextValue>(sidenavContextValue);
