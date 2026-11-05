import { LSP_LANGS } from '@cloud-editor-mono/ide-workbench/lib/code-mirror/extensions/lsp/lsp-consts';
import { describe, expect, it } from 'vitest';

import goLspWorkspaceSource from '../../../internal/lsp/lsp_workspace.go?raw';

// Synced to the LSP workspace without being opened in a language server:
// arduino-language-server reads sketch.yaml from the workspace.
const SYNC_ONLY_EXTENSIONS = ['yaml'];

const readGoLspFileExtensions = (): string[] => {
  const block = goLspWorkspaceSource.match(
    /var LspFileExtensions = \[\]string\{([^}]*)\}/,
  );
  if (!block) {
    throw new Error('LspFileExtensions not found in lsp_workspace.go');
  }
  return [...block[1].matchAll(/"\.([^"]+)"/g)].map((match) => match[1]);
};

describe('LSP_LANGS', () => {
  it('matches LspFileExtensions in the Go backend', () => {
    expect([...Object.keys(LSP_LANGS), ...SYNC_ONLY_EXTENSIONS].sort()).toEqual(
      readGoLspFileExtensions().sort(),
    );
  });
});
