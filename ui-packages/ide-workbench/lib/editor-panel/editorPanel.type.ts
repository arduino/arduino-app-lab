import { CodeEditorLogic } from '../code-editor';
import { EditorControlsHandlers } from '../editor-controls';
import { TabsBarLogic } from '../editor-tabs-bar';

export type { TabsBarLogic };

export interface EditorPanelFile {
  id: string;
  ext: string;
  getData: () => string | undefined;
  error?: Error;
}

export type EditorControlsProps =
  | { hideControls: false; editorControlsHandlers: EditorControlsHandlers }
  | { hideControls: true; editorControlsHandlers: undefined };

export type EditorPanelLogic = () => {
  codeEditorLogic: CodeEditorLogic;
  tabsBarLogic: TabsBarLogic;
  selectedFile?: EditorPanelFile;
  isFullscreen: boolean;
  codeIsFormatting: boolean;
  isConcurrent?: boolean;
  hideTabs?: boolean;
  markdownCanBeRendered?: boolean;
  shouldRenderMarkdown?: boolean;
  setShouldRenderMarkdown?: (value: boolean) => void;
  canSwitchMarkdownMode?: boolean;
  /**
   * Opaque app-owned state, forwarded per pane to content renderers as
   * `PaneContentContext.extras`. The shared panel never inspects it: the
   * app that packs it is the same app whose injected renderers (see the
   * `contentRenderers` prop) read it back, so it stays app-typed on both
   * ends (e.g. App Lab's brick sub-tab state, `AppLabPaneExtras`).
   */
  paneExtras?: { A?: unknown; B?: unknown };
  openExternalLink?: (url: string) => void;
  readOnly?: boolean;
  isSplit?: boolean;
  /**
   * Open or activate a file in the right (split) panel WITHOUT mutating the
   * left panel's selection. When invoked with `fileId === undefined` (eg.
   * from the split toggle button) the currently selected left-panel file is
   * mirrored on the right. When invoked with a specific `fileId` (eg. from
   * the tab "Split Right" context-menu action or a drop on the split zone)
   * that tab is moved/added to the right panel.
   *
   * Calling this with a file already shown on the right is a no-op (the
   * right panel re-selects the same tab).
   */
  openOrPushToSplit?: (fileId?: string) => void;
  /**
   * Duplicate the given file from `fromPanel` into the opposite panel (Split
   * sub-feature). When `fileId` is undefined the currently selected file
   * in `fromPanel` is used. Called by the per-panel Split CTA button and the
   * Split Right / Split Left tab context-menu items.
   */
  splitToOtherPanel?: (
    fileId: string | undefined,
    fromPanel: 'A' | 'B',
  ) => void;
  /**
   * Move the given file from `fromPanel` to the opposite panel (file is
   * removed from the origin). Called by cross-panel tab drags and the
   * right-edge drop zone. Idempotent on destination. `toIndex` positions
   * the file in the destination tab list (cross-bar drops); appended /
   * adjacent-inserted when omitted.
   */
  moveTabToOtherPanel?: (
    fileId: string,
    fromPanel: 'A' | 'B',
    toIndex?: number,
  ) => void;
  /**
   * Open `fileId` in `targetPanel`, creating panel B if needed. Idempotent:
   * if the file is already a tab there it is simply selected. Used by
   * file-tree drops on the editor body.
   */
  openFileInPanel?: (fileId: string, targetPanel: 'A' | 'B') => void;
  /**
   * The panel the user last interacted with. Bound to focus/pointer events
   * on each panel so the parent can route file-tree clicks into the active
   * panel.
   */
  activeEditorPanel?: 'A' | 'B';
  /**
   * Mark a panel as active. Wired to focus/pointer-down on each panel's
   * container so clicking inside a panel makes it the target for subsequent
   * file-tree clicks.
   */
  setActiveEditorPanel?: (panel: 'A' | 'B') => void;
  /**
   * Number of tabs currently in panel A. Used by the cross-panel drop zone
   * to suppress the overlay when an A→B tab drag has nowhere to land
   * (A has only one tab and no panel B exists to collapse into).
   */
  panelATabsCount?: number;
  splitPanelCodeEditorLogic?: CodeEditorLogic;
  splitPanelTabsBarLogic?: TabsBarLogic;
  splitPanelFileId?: string;
  splitPanelFile?: EditorPanelFile;
  splitPanelShouldRenderMarkdown?: boolean;
  splitPanelSetShouldRenderMarkdown?: (value: boolean) => void;
  splitPanelCanSwitchMarkdownMode?: boolean;
  /**
   * Persisted width of the left (A) panel as a percentage (0-100). When
   * provided, the panel group seeds its initial layout from this value.
   * `react-resizable-panels` only reads `defaultSize` on mount, so the
   * panel group is remounted (via `key`) when this value first arrives
   * from async hydration.
   */
  storedSplitProportionLeft?: number;
  /**
   * Called (debounced) whenever the user drags the split separator. The
   * receiver is expected to persist the value so the next session
   * restores the same layout.
   */
  onSplitResize?: (leftPanelPercent: number) => void;
  /**
   * Toggle the agent side panel (a separate, additive entry point from the
   * footer-bar full-screen Agent Mode swap). Undefined hides the toolbar
   * button entirely.
   */
  onToggleAgentPanel?: VoidFunction;
  /** Whether the agent side panel is currently open — drives the button's pressed state. */
  agentPanelOpen?: boolean;
} & EditorControlsProps;
