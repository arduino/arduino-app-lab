import { EditorPanelLogic } from '../../../editor-panel';
import { KeywordMap, LspState, SelectableFileData } from '../../shared';

export type AppLabEditorPanelLogic = () => {
  editorPanelLogic: EditorPanelLogic;
  getKeywords: () => KeywordMap | undefined;
  onCopyCode: () => void;
  onFileError?: (error: Error) => void;
  openFiles: SelectableFileData[];
  readOnly: boolean;
  lspState?: LspState;
};
