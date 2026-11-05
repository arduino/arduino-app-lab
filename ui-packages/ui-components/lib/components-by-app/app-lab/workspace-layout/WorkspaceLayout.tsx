import { SplitDragProvider } from '@cloud-editor-mono/ide-workbench/lib/editor-panel/SplitDragContext';
import clsx from 'clsx';
import React, { useEffect, useMemo, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import {
  CONSOLE_PANEL_COLLAPSED_SIZE_PX,
  CONSOLE_PANEL_MIN_SIZE_PX,
  EDITOR_PANEL_MIN_SIZE_PX,
  LSP_REFERENCES_PANEL_DEFAULT_SIZE_PX,
  LSP_REFERENCES_PANEL_MIN_SIZE_PX,
  SIDE_PANEL_COLLAPSED_SIZE_PX,
  SIDE_PANEL_DEFAULT_SIZE_PX,
  SIDE_PANEL_MAX_SIZE_PX,
  SIDE_PANEL_MIN_SIZE_PX,
} from './constants';
import { usePersistedFlag } from './hooks/usePersistedFlag';
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
  referencesContent?: WorkspaceLayoutContent | null;
  editorContent: WorkspaceLayoutContent;
  consoleContent: WorkspaceLayoutContent;
  appId?: string;
}
const SIDE_PANEL_ID = 'side';
const MAIN_PANEL_ID = 'main';
const LSP_REFERENCES_PANEL_ID = 'references';
const EDITOR_STACK_PANEL_ID = 'editor-stack';
const EDITOR_PANEL_ID = 'editor';
const CONSOLE_PANEL_ID = 'console';

/**
 * Set when the user opens the sidebar while the references panel is showing:
 * they want both, so the references panel stops collapsing the sidebar from then on.
 */
const SIDE_PANEL_AUTO_COLLAPSE_DISABLED_KEY = `${panelStorageKey(
  SIDE_PANEL_ID,
)}:auto-collapse-disabled`;

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  sideContent,
  referencesContent,
  editorContent,
  consoleContent,
  appId,
}) => {
  const showLspReferencesPanel = referencesContent != null;

  const sidePanelAutoCollapseDisabled = usePersistedFlag(
    SIDE_PANEL_AUTO_COLLAPSE_DISABLED_KEY,
  );
  const isSidePanelAutoCollapseDisabled = sidePanelAutoCollapseDisabled.value;

  const sidePanel = useWorkspacePanel({
    storageKey: panelStorageKey(SIDE_PANEL_ID),
    // While the references panel holds the sidebar closed, the sidebar's own
    // remembered size must not move — the user did not ask for this.
    persist: !showLspReferencesPanel || isSidePanelAutoCollapseDisabled,
  });
  const lspReferencesPanel = useWorkspacePanel({
    storageKey: panelStorageKey(LSP_REFERENCES_PANEL_ID),
    defaultSize: LSP_REFERENCES_PANEL_DEFAULT_SIZE_PX,
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

  const didAutoCollapseSidePanel = useRef(false);
  const setSidePanelCollapsed = sidePanel.api.setCollapsed;
  const sidePanelIsCollapsed = sidePanel.api.isCollapsed;
  const sidePanelHandle = sidePanel.panel;
  const disableSidePanelAutoCollapse = sidePanelAutoCollapseDisabled.set;

  const getLatestLspReferencesPanelSize = lspReferencesPanel.getLatestSize;
  const lspReferencesPanelDefaultSize = useMemo(() => {
    const latest = showLspReferencesPanel
      ? getLatestLspReferencesPanelSize()
      : undefined;
    return latest ?? LSP_REFERENCES_PANEL_DEFAULT_SIZE_PX;
  }, [showLspReferencesPanel, getLatestLspReferencesPanelSize]);

  /**
   * Showing the references panel collapses the sidebar; closing it reopens it,
   * but only if the collapse was ours.
   */
  useEffect(() => {
    if (!sidePanelHandle) {
      return;
    }
    if (showLspReferencesPanel) {
      if (!sidePanelHandle.isCollapsed() && !isSidePanelAutoCollapseDisabled) {
        setSidePanelCollapsed(true);
        didAutoCollapseSidePanel.current = true;
      }
    } else if (didAutoCollapseSidePanel.current) {
      setSidePanelCollapsed(false);
      didAutoCollapseSidePanel.current = false;
    }
  }, [
    showLspReferencesPanel,
    sidePanelHandle,
    setSidePanelCollapsed,
    isSidePanelAutoCollapseDisabled,
  ]);

  /**
   * Opening the sidebar while the references panel shows says the user wants
   * both, so the auto-collapse is disabled for good — but only while it shows,
   * since collapsing and reopening the sidebar is otherwise ordinary work.
   */
  const wasSidePanelCollapsed = useRef(sidePanelIsCollapsed);
  useEffect(() => {
    const wasCollapsed = wasSidePanelCollapsed.current;
    wasSidePanelCollapsed.current = sidePanelIsCollapsed;
    if (showLspReferencesPanel && wasCollapsed && !sidePanelIsCollapsed) {
      disableSidePanelAutoCollapse();
      didAutoCollapseSidePanel.current = false;
    }
  }, [
    showLspReferencesPanel,
    sidePanelIsCollapsed,
    disableSidePanelAutoCollapse,
  ]);

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
          defaultSize={sidePanel.sizeAtMount ?? SIDE_PANEL_DEFAULT_SIZE_PX}
          minSize={SIDE_PANEL_MIN_SIZE_PX}
          maxSize={SIDE_PANEL_MAX_SIZE_PX}
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
          id={MAIN_PANEL_ID}
          className={clsx(styles['panel'], styles['panel-main'])}
        >
          <Group className={styles['group']} orientation="horizontal">
            {showLspReferencesPanel && (
              <>
                <Panel
                  id={LSP_REFERENCES_PANEL_ID}
                  panelRef={lspReferencesPanel.setRef}
                  className={clsx(styles['panel'], styles['panel-references'])}
                  defaultSize={lspReferencesPanelDefaultSize}
                  minSize={LSP_REFERENCES_PANEL_MIN_SIZE_PX}
                  groupResizeBehavior="preserve-pixel-size"
                  onResize={(): void => {
                    lspReferencesPanel.onResize();
                  }}
                >
                  {typeof referencesContent === 'function'
                    ? referencesContent(lspReferencesPanel.api)
                    : referencesContent}
                </Panel>

                <Separator className={styles['separator']} />
              </>
            )}

            <Panel id={EDITOR_STACK_PANEL_ID} className={styles['panel']}>
              <Group className={styles['group']} orientation="vertical">
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
                  className={styles['panel']}
                  collapsible
                  defaultSize={
                    consolePanel.sizeAtMount ?? CONSOLE_PANEL_COLLAPSED_SIZE_PX
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
        </Panel>
      </Group>
    </SplitDragProvider>
  );
};
