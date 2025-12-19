import {
  AppExamples,
  AppSettings,
  Bricks,
  Learn,
  Login,
  Models,
  MyApps,
} from '@cloud-editor-mono/images/assets/icons';

import { messages } from './messages';
import { SidePanelItemId, SidePanelItemRecord } from './sidePanel.type';

const sidePanelItemsDictionary: SidePanelItemRecord = {
  [SidePanelItemId.MyApps]: {
    Icon: MyApps,
    label: messages.myAppsLabel,
    id: SidePanelItemId.MyApps,
    sectionId: 'top',
    enabled: true,
  },
  [SidePanelItemId.Examples]: {
    Icon: AppExamples,
    label: messages.examplesLabel,
    id: SidePanelItemId.Examples,
    sectionId: 'top',
    enabled: true,
  },
  [SidePanelItemId.Bricks]: {
    Icon: Bricks,
    label: messages.bricksLabel,
    id: SidePanelItemId.Bricks,
    sectionId: 'middle',
    enabled: true,
  },
  [SidePanelItemId.AiModels]: {
    Icon: Models,
    label: messages.aiModelsLabel,
    id: SidePanelItemId.AiModels,
    sectionId: 'middle',
  },
  [SidePanelItemId.Learn]: {
    Icon: Learn,
    label: messages.learnLabel,
    id: SidePanelItemId.Learn,
    sectionId: 'bottom',
    enabled: true,
  },
  [SidePanelItemId.Settings]: {
    Icon: AppSettings,
    label: messages.settingsLabel,
    id: SidePanelItemId.Settings,
    sectionId: 'bottom',
    enabled: false,
  },
  [SidePanelItemId.Login]: {
    Icon: Login,
    label: messages.loginLabel,
    id: SidePanelItemId.Login,
  },
};

export const sidePanelItems = Object.values(sidePanelItemsDictionary);
