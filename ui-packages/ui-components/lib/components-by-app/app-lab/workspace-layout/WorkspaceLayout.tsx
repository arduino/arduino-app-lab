import clsx from 'clsx';
import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { SplitDragProvider } from '../../../editor-panel/SplitDragContext';
import {
  CONSOLE_PANEL_COLLAPSED_SIZE_PX,
  CONSOLE_PANEL_MIN_SIZE_PX,
  EDITOR_PANEL_MIN_SIZE_PX,
  SIDE_PANEL_COLLAPSED_SIZE_PX,
  SIDE_PANEL_DEFAULT_SIZE_PX,
  SIDE_PANEL_MIN_SIZE_PX,
} from './constants';
import {
  panelStorageKey,
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

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  sideContent,
  editorContent,
  consoleContent,
  appId,
}) => {
  const sidePanel = useWorkspacePanel({
    storageKey: panelStorageKey(SIDE_PANEL_ID),
  });
  const consolePanel = useWorkspacePanel({
    storageKey: panelStorageKey(CONSOLE_PANEL_ID, appId),
    defaultSize: CONSOLE_PANEL_MIN_SIZE_PX,
    sibling: {
      minSizePx: EDITOR_PANEL_MIN_SIZE_PX,
    },
  });
  const editorPanel = useWorkspacePanel({
    storageKey: panelStorageKey(EDITOR_PANEL_ID),
  });

  return (
    <SplitDragProvider>
      <Group
        className={clsx(styles['group'], styles['group-root'])}
        orientation="horizontal"
      >
        <Panel
          id={SIDE_PANEL_ID}
          panelRef={sidePanel.setRef}
          className={clsx(styles['panel'], styles['panel-left'])}
          collapsible
          defaultSize={sidePanel.storedSize ?? SIDE_PANEL_DEFAULT_SIZE_PX}
          minSize={SIDE_PANEL_MIN_SIZE_PX}
          collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PX}
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
            className={clsx(styles['group'], styles['group-inner'])}
            orientation="vertical"
          >
            <Panel
              id={EDITOR_PANEL_ID}
              className={clsx(styles['panel'], styles['panel-editor'])}
              minSize={EDITOR_PANEL_MIN_SIZE_PX}
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
              defaultSize={
                consolePanel.storedSize ?? CONSOLE_PANEL_COLLAPSED_SIZE_PX
              }
              minSize={CONSOLE_PANEL_MIN_SIZE_PX}
              collapsedSize={CONSOLE_PANEL_COLLAPSED_SIZE_PX}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(): void => {
                consolePanel.onResize();
              }}
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
