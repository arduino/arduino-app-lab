import {
  IconMediaLibraryBooksNormal,
  IconNavigationDashboardNormal,
  IconTechnologyCablePlugNormal,
} from '@arduino/react-icons';
import { Brick, NavigationTable } from '@cloud-editor-mono/images/assets/icons';
import { ReactNode } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { messages } from './messages';
import { Root } from './Root';
import { SidePanelItemId, SidePanelLogic } from './sidePanel.type';
import { Accordion } from './sub-components/Accordion';
import { AppsAddButton } from './sub-components/AppsAddButton';
import { BoardItem } from './sub-components/BoardItem';
import { Bottom } from './sub-components/Bottom';
import { Content } from './sub-components/Content';
import { Row } from './sub-components/Row';

export interface SidePanelProps {
  sidePanelLogic: SidePanelLogic;
  // Optional promo slot rendered above the bottom account row (e.g. the agent-mode banner).
  banner?: ReactNode;
}

// AppLab nav sidebar: a concrete composition of the SidePanel.* primitives.
// The agentic sidebar is a separate composition built from the same primitives.
const AppLabSidePanel = ({
  sidePanelLogic,
  banner,
}: SidePanelProps): JSX.Element | null => {
  const {
    visible,
    activeItemId,
    board,
    boards,
    onSelectBoard,
    onCreateApp,
    onImportApp,
    user,
  } = sidePanelLogic();

  const { formatMessage } = useI18n();

  if (!visible) {
    return null;
  }

  return (
    <SidePanel.Root>
      <SidePanel.Content>
        <SidePanel.BoardItem
          board={board}
          boards={boards}
          onSelectBoard={onSelectBoard}
        />
        <SidePanel.Row
          id={SidePanelItemId.MyApps}
          icon={<IconNavigationDashboardNormal />}
          title={formatMessage(messages.appsLabel)}
          route="/my-apps"
          active={activeItemId === SidePanelItemId.MyApps}
          trailing={
            <AppsAddButton
              onCreateApp={onCreateApp}
              onImportApp={onImportApp}
            />
          }
        />
        <SidePanel.Accordion
          title={formatMessage(messages.learnAndExploreLabel)}
        >
          <SidePanel.Row
            id={SidePanelItemId.Inspirations}
            icon={<NavigationTable />}
            title={formatMessage(messages.inspirationsLabel)}
            route="/inspirations"
            active={activeItemId === SidePanelItemId.Inspirations}
          />
          <SidePanel.Row
            id={SidePanelItemId.Examples}
            icon={<IconTechnologyCablePlugNormal />}
            title={formatMessage(messages.examplesLabel)}
            route="/examples"
            active={activeItemId === SidePanelItemId.Examples}
          />
          <SidePanel.Row
            id={SidePanelItemId.Resources}
            icon={<IconMediaLibraryBooksNormal />}
            title={formatMessage(messages.resourcesLabel)}
            route="/learn"
            active={activeItemId === SidePanelItemId.Learn}
          />
        </SidePanel.Accordion>
        <SidePanel.Accordion title={formatMessage(messages.bricksManagerLabel)}>
          <SidePanel.Row
            id={SidePanelItemId.Bricks}
            icon={<Brick />}
            title={formatMessage(messages.bricksLabel)}
            route="/bricks"
            active={activeItemId === SidePanelItemId.Bricks}
          />
        </SidePanel.Accordion>
        {banner}
      </SidePanel.Content>
      <SidePanel.Bottom initials={user?.initials} activeItemId={activeItemId} />
    </SidePanel.Root>
  );
};

export const SidePanel = Object.assign(AppLabSidePanel, {
  Root,
  Content,
  BoardItem,
  Row,
  Accordion,
  Bottom,
});
