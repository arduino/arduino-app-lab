import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from 'react-resizable-panels';

import { SplitDragProvider } from '../../../editor-panel/SplitDragContext';
import {
  useWorkspacePanel,
  WorkspacePanelAPI,
} from './hooks/useWorkspacePanel';
import styles from './workspace-layout.module.scss';

type WorkspaceLayoutContent =
  | React.ReactNode
  | ((api: WorkspacePanelAPI) => React.ReactNode);

export interface WorkspaceLayoutProps {
  sideContent: WorkspaceLayoutContent;
  editorContent: WorkspaceLayoutContent;
  consoleContent: WorkspaceLayoutContent;
  appId?: string;
}
const SIDE_PANEL_ID = 'side';
const RIGHT_PANEL_ID = 'right';
const EDITOR_PANEL_ID = 'editor';
const CONSOLE_PANEL_ID = 'console';

const SIDE_PANEL_DEFAULT_SIZE_PX = 300;
const CONSOLE_PANEL_DEFAULT_SIZE_PX = 200;

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  sideContent,
  editorContent,
  consoleContent,
  appId,
}) => {
  const sidePanel = useWorkspacePanel({
    id: 'side',
    defaultSize: SIDE_PANEL_DEFAULT_SIZE_PX,
  });
  const consolePanel = useWorkspacePanel({
    id: 'console',
    defaultSize: CONSOLE_PANEL_DEFAULT_SIZE_PX,
  });
  const editorPanel = useWorkspacePanel({
    id: 'editor',
  });

  // Persistence for side and console panels — IDs are scoped per app so each
  // app remembers its own layout independently.
  const sideGroupLayout = useDefaultLayout({
    id: 'side-group',
  });
  const consoleGroupLayout = useDefaultLayout({
    id: appId ? `${appId}-console-group` : 'console-group',
  });

  // Collapse the console panel on first visit to an app (no saved layout yet).
  const initialCollapseHandled = useRef(false);
  useEffect(() => {
    if (
      appId &&
      consoleGroupLayout.defaultLayout == null &&
      !initialCollapseHandled.current &&
      consolePanel.panel
    ) {
      initialCollapseHandled.current = true;
      consolePanel.panel.collapse();
    }
  }, [appId, consoleGroupLayout.defaultLayout, consolePanel.panel]);

  return (
    <SplitDragProvider>
      <Group
        defaultLayout={sideGroupLayout.defaultLayout}
        onLayoutChange={sideGroupLayout.onLayoutChanged}
        className={clsx(styles['group'], styles['group-root'])}
        orientation="horizontal"
      >
        <Panel
          id={SIDE_PANEL_ID}
          panelRef={sidePanel.setRef}
          className={clsx(styles['panel'], styles['panel-left'])}
          collapsible
          defaultSize={SIDE_PANEL_DEFAULT_SIZE_PX}
          minSize={152}
          collapsedSize={44}
          groupResizeBehavior="preserve-pixel-size"
          onResize={(): void => {
            sidePanel.onResize();
          }}
        >
          {typeof sideContent === 'function'
            ? sideContent(sidePanel.api)
            : sideContent}
        </Panel>

        <Separator className={styles['separator']} />

        <Panel
          id={RIGHT_PANEL_ID}
          className={clsx(styles['panel'], styles['panel-right'])}
        >
          <Group
            defaultLayout={consoleGroupLayout.defaultLayout}
            onLayoutChanged={consoleGroupLayout.onLayoutChanged}
            className={clsx(styles['group'], styles['group-inner'])}
            orientation="vertical"
          >
            <Panel
              id={EDITOR_PANEL_ID}
              className={clsx(styles['panel'], styles['panel-editor'])}
              minSize={40}
            >
              {typeof editorContent === 'function'
                ? editorContent(editorPanel.api)
                : editorContent}
            </Panel>

            <Separator className={styles['separator']} />

            <Panel
              id={CONSOLE_PANEL_ID}
              panelRef={consolePanel.setRef}
              className={clsx(styles['panel'], styles['panel-console'])}
              collapsible
              defaultSize={CONSOLE_PANEL_DEFAULT_SIZE_PX}
              minSize={150}
              collapsedSize={36}
              groupResizeBehavior={
                consolePanel.api.isMaximized
                  ? 'preserve-relative-size'
                  : 'preserve-pixel-size'
              }
              onResize={consolePanel.onResize}
              onDrag={consolePanel.onDrag}
            >
              {typeof consoleContent === 'function'
                ? consoleContent(consolePanel.api)
                : consoleContent}
            </Panel>
          </Group>
        </Panel>
      </Group>
    </SplitDragProvider>
  );
};
