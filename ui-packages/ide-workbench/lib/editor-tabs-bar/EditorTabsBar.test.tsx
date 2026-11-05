import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  EditorComponentsProvider,
  EditorIconButtonProps,
} from '../editor-components';
import EditorTabsBar from './EditorTabsBar';
import { TabsBarLogic } from './EditorTabsBar.type';

// jsdom has no layout engine and no ResizeObserver; useTabsBarScroll needs one.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const tabsBarLogic: TabsBarLogic = () => ({
  tabs: [],
  selectTab: vi.fn(),
  selectSecretsTab: vi.fn(),
  closeTab: vi.fn(),
  updateTabOrder: vi.fn(),
  validateFileName: vi.fn(),
  makeUniqueFileName: vi.fn(),
  addFile: vi.fn(),
  renameFile: vi.fn(),
  deleteFile: vi.fn(),
  replaceFileNameInvalidCharacters: (name: string) => name,
  getFileIcon: () => undefined,
  isExampleSketchRoute: false,
  hasSetHeightOnHover: false,
  isReadOnly: false,
});

const renderBar = (
  props: Partial<React.ComponentProps<typeof EditorTabsBar>> = {},
  wrapper?: React.FC<{ children: React.ReactNode }>,
): ReturnType<typeof render> =>
  render(<EditorTabsBar tabsBarLogic={tabsBarLogic} {...props} />, {
    wrapper,
  });

describe('EditorTabsBar toggles', () => {
  it('calls onToggle when the split toggle is pressed', () => {
    const onToggle = vi.fn();
    renderBar({ splitToggle: { label: 'Split view', onToggle } });

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith();
  });

  it('marks the agent toggle as pressed only while the panel is open', () => {
    const { rerender } = renderBar({
      agentPanel: { label: 'Agent', isOpen: false, onToggle: vi.fn() },
    });
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(
      <EditorTabsBar
        tabsBarLogic={tabsBarLogic}
        agentPanel={{ label: 'Agent', isOpen: true, onToggle: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not call onToggle when the split toggle is disabled', () => {
    const onToggle = vi.fn();
    renderBar({
      splitToggle: { label: 'Split view', disabled: true, onToggle },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('renders the host IconButton when one is injected', () => {
    const received: EditorIconButtonProps[] = [];
    const HostIconButton: React.FC<EditorIconButtonProps> = (
      props: EditorIconButtonProps,
    ) => {
      const { label, onPress } = props;
      received.push(props);
      return (
        <button data-testid="host-button" onClick={onPress}>
          {label}
        </button>
      );
    };
    const onToggle = vi.fn();
    renderBar(
      {
        splitToggle: { label: 'Split view', onToggle },
        agentPanel: { label: 'Agent', isOpen: true, onToggle: vi.fn() },
      },
      ({ children }) => (
        <EditorComponentsProvider components={{ IconButton: HostIconButton }}>
          {children}
        </EditorComponentsProvider>
      ),
    );

    expect(screen.getAllByTestId('host-button')).toHaveLength(2);
    expect(received.at(-1)).toMatchObject({ label: 'Agent', isPressed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
