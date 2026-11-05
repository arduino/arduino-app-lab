import {
  PaneContentContext,
  PaneContentRenderer,
} from '@cloud-editor-mono/ide-workbench/lib/editor-panel/index';
import { BRICK_FILE_EXTENSION } from '@cloud-editor-mono/ide-workbench/lib/editor-tabs-bar/index';
import { Suspense } from 'react';

import { SecretsPaneExtras } from '../../../secrets-editor';
import { BrickDetailLogic, BrickDetailTabId } from '../brick-detail';
import styles from './app-lab-editor-panel.module.scss';
import { BrickDetail, MarkdownReader } from './lazyViews';

/**
 * App Lab's per-pane state for its content renderers, packed by the App
 * Lab logic layer into `EditorPanelLogic.paneExtras` and read back here
 * from `PaneContentContext.extras`. The shared EditorPanel forwards it
 * opaquely and never inspects it. Extends the secrets contract because
 * App Lab also registers `secretsWorkspaceRenderer` (pane A only).
 */
export interface AppLabPaneExtras extends SecretsPaneExtras {
  brickDetailLogic?: BrickDetailLogic;
  /** Selected brick sub-tab (e.g. 'overview', 'examples'), persisted per
   * (pane, brickId) so the same brick can be on different sub-tabs in
   * panes A and B. */
  brickSelectedTab?: BrickDetailTabId;
  setBrickSelectedTab?: (value: BrickDetailTabId) => void;
}

const getExtras = (ctx: PaneContentContext): AppLabPaneExtras | undefined =>
  ctx.extras as AppLabPaneExtras | undefined;

const brickContentRenderer: PaneContentRenderer = {
  id: 'app-lab-brick',
  match: (ctx) =>
    ctx.file.ext === BRICK_FILE_EXTENSION && !!getExtras(ctx)?.brickDetailLogic,
  render: (ctx) => {
    const extras = getExtras(ctx);
    const brickDetailLogic = extras?.brickDetailLogic;
    if (!brickDetailLogic) return <></>; // unreachable: match() requires it
    return (
      <div className={styles['brick-container']}>
        <Suspense fallback={null}>
          <BrickDetail
            brickId={ctx.file.id}
            brickDetailLogic={brickDetailLogic}
            selectedTab={extras?.brickSelectedTab}
            onSelectedTabChange={extras?.setBrickSelectedTab}
          />
        </Suspense>
      </div>
    );
  },
};

const markdownContentRenderer: PaneContentRenderer = {
  id: 'app-lab-markdown',
  match: ({ file, shouldRenderMarkdown }) =>
    file.ext === 'md' && !!shouldRenderMarkdown,
  render: ({ file, openExternalLink, onCopyCode }) => (
    <div className={styles['markdown-container']}>
      <Suspense fallback={null}>
        <MarkdownReader
          key={file.id}
          content={file.getData()}
          onOpenExternalLink={openExternalLink}
          onCopyCode={onCopyCode}
        />
      </Suspense>
    </div>
  ),
};

/**
 * The content contributions App Lab registers on the shared EditorPanel
 * (see ADR-0002). Passed through the `contentRenderers` prop by
 * AppLabEditorPanel.
 */
export const appLabContentRenderers: PaneContentRenderer[] = [
  brickContentRenderer,
  markdownContentRenderer,
];
