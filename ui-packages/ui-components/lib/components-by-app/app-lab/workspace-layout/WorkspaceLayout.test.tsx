/**
 * Tests for WorkspaceLayout's pixel-persisted panel sizes (first-visit
 * fallback, debounced persist) for both the console and side panels, plus the
 * content rendering that this component owns.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { panelStorageKey } from './hooks/useWorkspacePanel';
import { WorkspaceLayout, WorkspaceLayoutProps } from './WorkspaceLayout';

const mockState = vi.hoisted(() => ({
  panels: new Map<string, PanelEntry>(),
  groupCalls: [] as Array<Record<string, unknown>>,
}));

// Minimal shape of a registered mock panel: its imperative handle plus the
// latest `onResize`/`onDrag` props the component passed on the last render.
interface PanelEntry {
  handle: {
    state: { collapsed: boolean; sizePx: number; sizePct: number };
    isCollapsed: Mock<[], boolean>;
    expand: Mock<[], void>;
    collapse: Mock<[], void>;
    resize: Mock<[value: number | string], void>;
    getSize: Mock<[], { inPixels: number; asPercentage: number }>;
  };
  onResize?: () => void;
  onDrag?: () => void;
}

interface MockPanelProps {
  id: string;
  panelRef?: (handle: PanelEntry['handle'] | null) => void;
  defaultSize?: number;
  collapsedSize?: number;
  onResize?: () => void;
  onDrag?: () => void;
  children?: React.ReactNode;
}

interface MockGroupProps {
  orientation?: string;
  defaultLayout?: unknown;
  onLayoutChange?: (layout: unknown) => void;
  onLayoutChanged?: (layout: unknown) => void;
  children?: React.ReactNode;
  [key: string]: unknown;
}

vi.mock('react-resizable-panels', async () => {
  const actualReact = (await vi.importActual('react')) as {
    default?: typeof import('react');
  } & typeof import('react');
  const React = actualReact.default ?? actualReact;
  const { panels, groupCalls } = mockState;

  // Mirrors the real hook: exposes the panel handle once the Panel registers
  // itself and a stable ref setter for the Panel's `panelRef` prop.
  const usePanelCallbackRef = (): [unknown, (handle: unknown) => void] => {
    const [panel, setPanel] = React.useState<unknown>(null);
    const setRef = React.useCallback(
      (handle: unknown) => setPanel(handle ?? null),
      [],
    );
    return [panel, setRef];
  };

  const Panel = (props: MockPanelProps): unknown => {
    const {
      id,
      panelRef,
      defaultSize,
      collapsedSize,
      onResize,
      onDrag,
      children,
    } = props;
    const handleRef = React.useRef(null as PanelEntry['handle'] | null);
    if (!handleRef.current) {
      // Model the group's total space so the hook's sibling-percentage math
      // (size.inPixels + otherPanelPx) resolves to a realistic available size.
      // The real library clamps a panel's size to fit the container and
      // derives its percentage from the total; mirror that here.
      const containerTotal = window.innerHeight;
      // The real library derives collapsed state from size: defaultSize ===
      // collapsedSize implies isCollapsed() === true.
      const sizePx = Math.min(defaultSize ?? 200, containerTotal);
      const state = {
        collapsed: collapsedSize != null && sizePx <= collapsedSize,
        sizePx,
        sizePct: (sizePx / containerTotal) * 100,
      };
      handleRef.current = {
        state,
        isCollapsed: vi.fn(() => state.collapsed),
        expand: vi.fn(() => {
          state.collapsed = false;
        }),
        collapse: vi.fn(() => {
          state.collapsed = true;
        }),
        resize: vi.fn((value: number | string) => {
          if (typeof value === 'number') {
            state.sizePx = value;
            state.sizePct = (value / containerTotal) * 100;
            state.collapsed = false;
          }
        }),
        getSize: vi.fn(() => ({
          inPixels: state.sizePx,
          asPercentage: state.sizePct,
        })),
      };
    }
    panels.set(id, { handle: handleRef.current, onResize, onDrag });
    React.useEffect(() => {
      panelRef?.(handleRef.current);
      return () => panelRef?.(null);
    }, [panelRef]);
    return React.createElement('div', { 'data-panel-id': id }, children);
  };

  const Group = (props: MockGroupProps): unknown => {
    groupCalls.push(props);
    return React.createElement(
      'div',
      { 'data-group-orientation': props.orientation },
      props.children,
    );
  };

  const Separator = (): unknown =>
    React.createElement('div', { 'data-separator': true });

  return {
    Group,
    Panel,
    Separator,
    usePanelCallbackRef,
  };
});

const CONSOLE_ID = 'console';
const SIDE_ID = 'side';
const APP_ID = 'app1';

const panelEntry = (id: string): PanelEntry => {
  const entry = mockState.panels.get(id);
  if (!entry) {
    throw new Error(`${id} panel was never registered`);
  }
  return entry;
};

const consoleEntry = (): PanelEntry => panelEntry(CONSOLE_ID);
const consoleHandle = (): PanelEntry['handle'] => consoleEntry().handle;

const sideEntry = (): PanelEntry => panelEntry(SIDE_ID);
const sideHandle = (): PanelEntry['handle'] => sideEntry().handle;

const storeConsoleSize = (px: number): void => {
  localStorage.setItem(panelStorageKey(CONSOLE_ID, APP_ID), JSON.stringify(px));
};

const readConsoleSize = (): number | undefined => {
  const raw = localStorage.getItem(panelStorageKey(CONSOLE_ID, APP_ID));
  return raw ? JSON.parse(raw) : undefined;
};

const storeSideSize = (px: number): void => {
  localStorage.setItem(panelStorageKey(SIDE_ID), JSON.stringify(px));
};

const readSideSize = (): number | undefined => {
  const raw = localStorage.getItem(panelStorageKey(SIDE_ID));
  return raw ? JSON.parse(raw) : undefined;
};

const layoutElement = (
  props: Partial<WorkspaceLayoutProps> = {},
): React.ReactElement => (
  <WorkspaceLayout
    appId={APP_ID}
    sideContent={<div>side-content</div>}
    editorContent={<div>editor-content</div>}
    consoleContent={<div>console-content</div>}
    {...props}
  />
);

const renderLayout = (
  props: Partial<WorkspaceLayoutProps> = {},
): ReturnType<typeof render> => render(layoutElement(props));

beforeEach(() => {
  mockState.panels.clear();
  mockState.groupCalls.length = 0;
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('WorkspaceLayout console default size', () => {
  it('starts collapsed on first visit (nothing stored)', () => {
    renderLayout();

    expect(consoleHandle().state.sizePx).toBe(36);
    expect(consoleHandle().isCollapsed()).toBe(true);
  });

  it('restores a stored expanded height', () => {
    storeConsoleSize(350);
    renderLayout();

    expect(consoleHandle().state.sizePx).toBe(350);
    expect(consoleHandle().isCollapsed()).toBe(false);
  });

  it('restores collapsed when the stored size is the collapsed strip', () => {
    storeConsoleSize(36);
    renderLayout();

    expect(consoleHandle().state.sizePx).toBe(36);
    expect(consoleHandle().isCollapsed()).toBe(true);
  });
});

describe('WorkspaceLayout console height persistence', () => {
  it('debounces a resize and stores the new pixel height', () => {
    vi.useFakeTimers();
    renderLayout();

    act(() => {
      consoleHandle().resize(400);
      consoleEntry().onResize?.();
      vi.advanceTimersByTime(300);
    });

    expect(readConsoleSize()).toBe(400);
  });

  it('does not persist a resize when unmounted within the debounce window', () => {
    vi.useFakeTimers();
    const { unmount } = renderLayout();

    act(() => {
      consoleHandle().resize(400);
      consoleEntry().onResize?.();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(readConsoleSize()).toBeUndefined();
  });
});

describe('WorkspaceLayout side panel persistence', () => {
  it('starts at the default width on first visit (nothing stored)', () => {
    renderLayout();

    expect(sideHandle().state.sizePx).toBe(216);
  });

  it('restores a stored expanded width', () => {
    storeSideSize(240);
    renderLayout();

    expect(sideHandle().state.sizePx).toBe(240);
    expect(sideHandle().isCollapsed()).toBe(false);
  });

  it('restores collapsed when the stored size is the collapsed strip', () => {
    storeSideSize(44);
    renderLayout();

    expect(sideHandle().state.sizePx).toBe(44);
    expect(sideHandle().isCollapsed()).toBe(true);
  });

  it('debounces a resize and stores the new pixel width globally', () => {
    vi.useFakeTimers();
    renderLayout();

    act(() => {
      sideHandle().resize(260);
      sideEntry().onResize?.();
      vi.advanceTimersByTime(300);
    });

    expect(readSideSize()).toBe(260);
  });

  it('renders the side, editor and console content', () => {
    renderLayout();

    expect(screen.getByText('side-content')).toBeInTheDocument();
    expect(screen.getByText('editor-content')).toBeInTheDocument();
    expect(screen.getByText('console-content')).toBeInTheDocument();
  });
});
