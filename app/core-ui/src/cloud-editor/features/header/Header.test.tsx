import { RbacCapability, RbacValue } from '@cloud-editor-mono/ui-components';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Header from './Header';
import { HeaderActions, HeaderItemId, HeaderLogic } from './Header.type';

vi.mock('@bcmi-labs/cloud-sidebar', () => ({
  CloudSidebar: (): null => null,
  HeaderPortal: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactNode => children,
}));

// The menu renders closed by default, so every part renders its children directly.
vi.mock('@bcmi-labs/art-ui/components', () => {
  const Passthrough = ({
    children,
  }: {
    children?: React.ReactNode;
  }): JSX.Element => <>{children}</>;
  const Element = ({
    children,
  }: {
    children?: React.ReactNode;
  }): JSX.Element => <div>{children}</div>;
  return {
    Breadcrumb: {
      Root: Passthrough,
      Item: Element,
      Separator: (): null => null,
    },
    DropdownMenu: {
      Root: Passthrough,
      Trigger: (): JSX.Element => <button>menu</button>,
      Content: Passthrough,
      Item: Element,
    },
    Button: Passthrough,
  };
});

const FULL_ACCESS: RbacValue = {
  [RbacCapability.EditSketch]: true,
  [RbacCapability.CreateSketch]: true,
  [RbacCapability.DeleteSketch]: true,
  [RbacCapability.UploadSketch]: true,
  [RbacCapability.CopyFromPreview]: true,
  [RbacCapability.UpdateThing]: true,
};

const VIEWER: RbacValue = {
  ...FULL_ACCESS,
  [RbacCapability.EditSketch]: false,
  [RbacCapability.CreateSketch]: false,
  [RbacCapability.DeleteSketch]: false,
  [RbacCapability.UploadSketch]: false,
};

const HEADER_ACTIONS: HeaderActions = {
  [HeaderItemId.Sketch]: {
    Rename: vi.fn(),
    Download: vi.fn(),
    Delete: vi.fn(),
    Share: vi.fn(),
    ShareToClassroom: vi.fn(),
  },
  [HeaderItemId.CustomLibrary]: {
    Download: vi.fn(),
    Delete: vi.fn(),
  },
  [HeaderItemId.Example]: {
    CopyToSketches: vi.fn(),
    Download: vi.fn(),
    Share: vi.fn(),
  },
};

const renderHeader = (headerItemId: HeaderItemId, rbac: RbacValue): void => {
  render(
    <Header
      headerLogic={(): ReturnType<HeaderLogic> => ({
        isReadOnly: false,
        headerItemId,
        itemName: 'my_sketch',
        headerActions: HEADER_ACTIONS,
        rbac,
      })}
    />,
  );
};

describe('Header', () => {
  it('shows the full sketch menu with full access', () => {
    renderHeader(HeaderItemId.Sketch, FULL_ACCESS);

    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Download')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides the sketch menu without sketch edit', () => {
    renderHeader(HeaderItemId.Sketch, VIEWER);

    expect(screen.queryByRole('button', { name: 'menu' })).toBeNull();
    expect(screen.queryByText('Rename')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('hides Delete in the sketch menu without sketch delete', () => {
    renderHeader(HeaderItemId.Sketch, {
      ...FULL_ACCESS,
      [RbacCapability.DeleteSketch]: false,
    });

    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('hides "Save in your sketches" on an example without sketch create', () => {
    renderHeader(HeaderItemId.Example, VIEWER);

    expect(screen.queryByText('Save in your sketches')).toBeNull();
    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('shows "Save in your sketches" on an example with sketch create', () => {
    renderHeader(HeaderItemId.Example, FULL_ACCESS);

    expect(screen.getByText('Save in your sketches')).toBeTruthy();
  });
});
