import { BrickDetailLogic } from '../app-lab-brick-detail/BrickDetail.type';
import { CodeEditorLogic } from '../code-editor';
import { EditorControlsHandlers } from '../editor-controls/editorControls.type';
import { TabsBarLogic } from '../editor-tabs-bar';
import { SecretsEditorLogic } from '../secrets-editor';

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
  markdownCanBeRendered?: boolean;
  shouldRenderMarkdown?: boolean;
  setShouldRenderMarkdown?: (value: boolean) => void;
  canSwitchMarkdownMode?: boolean;
  openExternalLink?: (url: string) => void;
  readOnly?: boolean;
} & EditorControlsProps;
