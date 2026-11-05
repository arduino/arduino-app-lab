import { EditorPanelLogic } from '@cloud-editor-mono/ide-workbench/lib/editor-panel/index';

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
