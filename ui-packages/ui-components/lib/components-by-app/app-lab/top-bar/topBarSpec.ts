import { MessageDescriptor } from 'react-intl';

import { messages } from '../side-panel/messages';
import { SidePanelItemId } from '../side-panel/sidePanel.type';

export interface TopBarItem {
  id: SidePanelItemId;
  label: MessageDescriptor;
}

// Breadcrumb page-title lookup by route id; the sidebar nav is composed
// explicitly in SidePanel.tsx and does not use this list
export const topBarItems: TopBarItem[] = [
  { id: SidePanelItemId.MyApps, label: messages.appsLabel },
  { id: SidePanelItemId.Examples, label: messages.examplesLabel },
  { id: SidePanelItemId.Inspirations, label: messages.inspirationsLabel },
  // Resources links here for now; title mirrors the sidebar item
  { id: SidePanelItemId.Learn, label: messages.resourcesLabel },
  { id: SidePanelItemId.Bricks, label: messages.bricksLabel },
  { id: SidePanelItemId.Settings, label: messages.settingsLabel },
  { id: SidePanelItemId.Account, label: messages.accountLabel },
];
