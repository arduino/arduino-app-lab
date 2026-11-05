import { FileExt } from '../language/setup';
import { LspId } from './lsp-types';

// Must match LspFileExtensions in
// standalone-apps/app-lab-desktop/internal/lsp/lsp_workspace.go;
// standalone-apps/app-lab-desktop/frontend/src/services/lspFileExtensions.test.ts
// fails when the two lists differ.
export const LSP_LANGS = {
  [FileExt.Ino]: 'arduino',
  [FileExt.C]: 'arduino',
  [FileExt.Cpp]: 'arduino',
  [FileExt.H]: 'arduino',
  [FileExt.Hpp]: 'arduino',
  [FileExt.Py]: 'python',
  [FileExt.Pyi]: 'python',
  [FileExt.Ts]: 'typescript',
  [FileExt.Js]: 'typescript',
  [FileExt.Mjs]: 'typescript',
  [FileExt.Cjs]: 'typescript',
  [FileExt.Tsx]: 'typescript',
  [FileExt.Jsx]: 'typescript',
  [FileExt.Html]: 'html',
  [FileExt.Css]: 'css',
  [FileExt.Scss]: 'css',
// eslint-disable-next-line prettier/prettier
} as const satisfies Partial<Record<FileExt, LspId>>;

export const LSP_WITH_PROVIDE_FORMATTER_INIT_OPTIONS: LspId[] = ['html', 'css'];
 
