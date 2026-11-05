import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RbacCapability, RbacValue } from '../rbac';
import SecretsEditor from './SecretsEditor';

const SECRETS = [{ name: 'SECRET_SSID', value: 'home-wifi' }];

const renderEditor = (rbac?: RbacValue): void => {
  render(
    <SecretsEditor
      secretsEditorLogic={(): ReturnType<
        React.ComponentProps<typeof SecretsEditor>['secretsEditorLogic']
      > => ({
        secrets: SECRETS,
        rbac,
        updateSecrets: vi.fn(),
        openDeleteSecretDialog: vi.fn(),
      })}
    />,
  );
};

describe('SecretsEditor', () => {
  it('shows the add and delete controls by default', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: /add new/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('hides the add and delete controls and disables the inputs without sketch edit', () => {
    renderEditor({
      [RbacCapability.EditSketch]: false,
      [RbacCapability.CreateSketch]: true,
      [RbacCapability.DeleteSketch]: false,
      [RbacCapability.UploadSketch]: true,
      [RbacCapability.CopyFromPreview]: true,
      [RbacCapability.UpdateThing]: true,
    });

    expect(screen.queryByRole('button', { name: /add new/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    screen
      .getAllByRole('textbox')
      .forEach((input) =>
        expect((input as HTMLInputElement).disabled).toBe(true),
      );
  });
});
