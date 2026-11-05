/**
 * Tests the secrets workspace renderer contract: it must reproduce the
 * pre-ADR-0002 hard-coded behavior (SecretsEditor takes over the editor
 * surface for the secrets pseudo-file) through the injection seam.
 */

import { PaneContentContext } from '@cloud-editor-mono/ide-workbench/lib/editor-panel/paneContentRenderer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SecretsEditorLogic } from './secretsEditor.type';
import {
  SecretsPaneExtras,
  secretsWorkspaceRenderer,
} from './secretsWorkspaceRenderer';

vi.mock('./SecretsEditor', () => ({
  default: () => <div data-testid="secrets-editor" />,
}));

const stubLogic = (() => ({})) as unknown as SecretsEditorLogic;

const makeCtx = (
  extras?: SecretsPaneExtras,
  ext = 'secrets',
): PaneContentContext => ({
  file: { id: 'secrets', ext, getData: () => undefined },
  paneId: 'A',
  extras,
});

describe('secretsWorkspaceRenderer', () => {
  it('matches the secrets pseudo-file when the extras carry the logic', () => {
    expect(
      secretsWorkspaceRenderer.match(
        makeCtx({ secretsEditorLogic: stubLogic }),
      ),
    ).toBe(true);
  });

  it('does not match without secretsEditorLogic or for other files', () => {
    expect(secretsWorkspaceRenderer.match(makeCtx(undefined))).toBe(false);
    expect(
      secretsWorkspaceRenderer.match(
        makeCtx({ secretsEditorLogic: stubLogic }, 'ino'),
      ),
    ).toBe(false);
  });

  it('renders the SecretsEditor', () => {
    render(
      secretsWorkspaceRenderer.render(
        makeCtx({ secretsEditorLogic: stubLogic }),
      ),
    );

    expect(screen.getByTestId('secrets-editor')).toBeInTheDocument();
  });
});
