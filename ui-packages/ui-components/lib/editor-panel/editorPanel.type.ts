import { CodeEditorLogic } from '../code-editor';
import { BrickDetailLogic } from '../components-by-app/app-lab';
import { EditorControlsHandlers } from '../editor-controls';
import { TabsBarLogic } from '../editor-tabs-bar';
import { SecretsEditorLogic } from '../secrets-editor';

export type { TabsBarLogic };

interface EditorPanelFile {
  id: string;
  ext: string;
  getData: () => string | undefined;
}

export type EditorControlsProps =
  | { hideControls: false; editorControlsHandlers: EditorControlsHandlers }
  | { hideControls: true; editorControlsHandlers: undefined };

export type EditorPanelLogic = () => {
  codeEditorLogic: CodeEditorLogic;
  brickDetailLogic?: BrickDetailLogic;
  secretsEditorLogic: SecretsEditorLogic;
  tabsBarLogic: TabsBarLogic;
  selectedFile?: EditorPanelFile;
  isFullscreen: boolean;
  codeIsFormatting: boolean;
  isConcurrent?: boolean;
  hideTabs?: boolean;
  isSnippet?: boolean;
  markdownCanBeRendered?: boolean;
  shouldRenderMarkdown?: boolean;
  setShouldRenderMarkdown?: (value: boolean) => void;
  canSwitchMarkdownMode?: boolean;
  /**
   * Currently selected brick sub-tab (e.g. 'overview', 'examples') for the
   * brick rendered in pane A. Persisted per (pane, brickId) so the same
   * brick can be on different sub-tabs in A and B.
   */
  brickSelectedTab?: string;
  setBrickSelectedTab?: (value: string) => void;
  openExternalLink?: (url: string) => void;
  readOnly?: boolean;
  isSplit?: boolean;
  /**
   * Open or activate a file in the right (split) pane WITHOUT mutating the
   * left pane's selection. When invoked with `fileId === undefined` (eg.
   * from the split toggle button) the currently selected left-pane file is
   * mirrored on the right. When invoked with a specific `fileId` (eg. from
   * the tab "Split Right" context-menu action or a drop on the split zone)
   * that tab is moved/added to the right pane.
   *
   * Calling this with a file already shown on the right is a no-op (the
   * right pane re-selects the same tab).
   */
  openOrPushToSplit?: (fileId?: string) => void;
  /**
   * Duplicate the given file from `fromPane` into the opposite pane (Split
   * sub-feature). When `fileId` is undefined the currently selected file
   * in `fromPane` is used. Called by the per-pane Split CTA button and the
   * Split Right / Split Left tab context-menu items.
   */
  splitToOtherPane?: (fileId: string | undefined, fromPane: 'A' | 'B') => void;
  /**
   * Move the given file from `fromPane` to the opposite pane (file is
   * removed from the origin). Called by cross-pane tab drags and the
   * right-edge drop zone. Idempotent on destination. `toIndex` positions
   * the file in the destination tab list (cross-bar drops); appended /
   * adjacent-inserted when omitted.
   */
  moveTabToOtherPane?: (
    fileId: string,
    fromPane: 'A' | 'B',
    toIndex?: number,
  ) => void;
  /**
   * Open `fileId` in `targetPane`, creating panel B if needed. Idempotent:
   * if the file is already a tab there it is simply selected. Used by
   * file-tree drops on the editor body.
   */
  openFileInPane?: (fileId: string, targetPane: 'A' | 'B') => void;
  /**
   * The pane the user last interacted with. Bound to focus/pointer events
   * on each pane so the parent can route file-tree clicks into the active
   * pane.
   */
  activePane?: 'A' | 'B';
  /**
   * Mark a pane as active. Wired to focus/pointer-down on each pane's
   * container so clicking inside a pane makes it the target for subsequent
   * file-tree clicks.
   */
  setActivePane?: (pane: 'A' | 'B') => void;
  /**
   * Number of tabs currently in pane A. Used by the cross-pane drop zone
   * to suppress the overlay when an A→B tab drag has nowhere to land
   * (A has only one tab and no panel B exists to collapse into).
   */
  paneATabsCount?: number;
  splitPaneCodeEditorLogic?: CodeEditorLogic;
  splitPaneTabsBarLogic?: TabsBarLogic;
  splitPaneFileId?: string;
  splitPaneFile?: {
    id: string;
    ext: string;
    getData: () => string | undefined;
  };
  splitPaneShouldRenderMarkdown?: boolean;
  splitPaneSetShouldRenderMarkdown?: (value: boolean) => void;
  splitPaneCanSwitchMarkdownMode?: boolean;
  /**
   * Brick detail logic for the right (split) pane. Same factory as pane
   * A — the hook is parameterized per call by brickId, so each pane
   * resolves its own brick.
   */
  splitPaneBrickDetailLogic?: BrickDetailLogic;
  splitPaneBrickSelectedTab?: string;
  splitPaneSetBrickSelectedTab?: (value: string) => void;
  /**
   * Persisted width of the left (A) pane as a percentage (0-100). When
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
  onSplitResize?: (leftPanePercent: number) => void;
} & EditorControlsProps;
