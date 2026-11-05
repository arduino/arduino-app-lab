import type { ViewInstances } from '../../../codeMirrorViewInstances';
import { LspId, LspRange } from '../lsp-types';

export interface LspReferenceRow {
  id: string;
  fileUri: string;
  lineNumber: number;
  excerpt: string;
  matchStart: number;
  matchEnd: number;
  range: LspRange;
}

export interface LspReferenceFileGroup {
  fileUri: string;
  fileName: string;
  rows: LspReferenceRow[];
}

export interface LspReferencesResult {
  symbol: string;
  groups: LspReferenceFileGroup[];
  totalCount: number;
  lspId: LspId;
  originViewInstanceId: ViewInstances;
}

export interface LspReferencesPanelActions {
  showLspReferences?: (result: LspReferencesResult) => void;
  closeLspReferences?: () => boolean;
}
