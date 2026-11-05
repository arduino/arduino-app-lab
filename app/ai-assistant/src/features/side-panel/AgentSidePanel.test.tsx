import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listSessions, renameSession, SessionSummary } from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { AgentSidePanel } from './AgentSidePanel';
import { useAgentSidePanelLogic } from './agentSidePanel.logic';

// SidePanel.Bottom navigates to the settings route, and there is no router around a bare render.
vi.mock('@tanstack/react-router', async () => ({
  ...(await vi.importActual('@tanstack/react-router')),
  useNavigate: (): VoidFunction => vi.fn(),
}));

const forgottenHandlers = vi.hoisted(
  (): ((appId: string, chatIds?: string[]) => void)[] => [],
);

// The panel's mutations hit the DI coding-agent service, which throws "not implemented" outside a running agent.
vi.mock('../../services', () => ({
  listAgents: (): { id: string; comingSoon?: boolean }[] => [{ id: 'claude' }],
  getAgent: (id?: string): { persistsNewSession: boolean } | undefined =>
    id === 'opencode' ? { persistsNewSession: true } : undefined,
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  pinSession: vi.fn(),
  renameSession: vi.fn(),
  onWorkspaceAppForgotten: (
    handler: (appId: string, chatIds?: string[]) => void,
  ): VoidFunction => {
    forgottenHandlers.push(handler);
    return () =>
      forgottenHandlers.splice(forgottenHandlers.indexOf(handler), 1);
  },
}));

const sessions: SessionSummary[] = [
  {
    id: 's1',
    title: 'Camera init',
    workspaceAppId: 'snack',
    workspaceName: 'Snack Sorter',
  },
  {
    id: 's2',
    title: 'Classifier tuning',
    workspaceAppId: 'snack',
    workspaceName: 'Snack Sorter',
  },
  {
    id: 's3',
    title: 'Wind readings',
    workspaceAppId: 'weather',
    workspaceName: 'Weather Station',
  },
  { id: 's4', title: 'How Bricks work' },
];

// Each row also renders its title into a tooltip, portaled to the body — querying inside the panel leaves those out.
let panel: HTMLElement;

const renderPanel = (): void => {
  panel = render(
    <AgentSidePanel boards={[]} onSelectBoard={vi.fn()} />,
  ).container;
};

const rows = (title: string): HTMLElement[] =>
  within(panel).queryAllByText(title);
const row = async (title: string): Promise<HTMLElement> =>
  within(panel).findByText(title);

describe('AgentSidePanel session folders', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    useAiAssistantStore
      .getState()
      .setAuth('claude', { authenticated: true, agentId: 'claude' });
    vi.mocked(listSessions).mockResolvedValue(sessions);
  });

  it('shows one folder per app plus the general one, expanding the folder of the open session', async () => {
    useChatStore.setState({ currentSessionId: 's3' });
    renderPanel();

    expect(await row('Snack Sorter')).toBeInTheDocument();
    expect(rows('Weather Station')).toHaveLength(1);
    expect(rows('Arduino Apps')).toHaveLength(1);

    // Only the open session's folder is expanded; the others keep their sessions out of the list.
    expect(rows('Wind readings')).toHaveLength(1);
    expect(rows('Camera init')).toHaveLength(0);
    expect(rows('How Bricks work')).toHaveLength(0);
  });

  it('opens a collapsed folder on click and closes it again', async () => {
    renderPanel();

    const folder = await row('Snack Sorter');
    fireEvent.click(folder);
    expect(rows('Camera init')).toHaveLength(1);
    expect(rows('Classifier tuning')).toHaveLength(1);

    fireEvent.click(folder);
    expect(rows('Camera init')).toHaveLength(0);
  });

  // The caret is the obvious thing to click, and it used to sit outside the row's click target.
  it('opens a collapsed folder from its caret too', async () => {
    renderPanel();

    const clickTarget = (await row('Snack Sorter')).closest(
      '[role="button"]',
    ) as HTMLElement;
    // The folder icon and the caret: both inside the click target, so the whole row toggles.
    const icons = clickTarget.querySelectorAll('svg');
    expect(icons).toHaveLength(2);

    fireEvent.click(icons[1]);
    expect(rows('Camera init')).toHaveLength(1);
  });

  // Pinning is what takes a session out of its folder: it must not show up in both places.
  it('lists a pinned session in the pinned group only', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { ...sessions[0], pinned: true },
      sessions[1],
    ]);
    renderPanel();

    expect(await row('Pinned')).toBeInTheDocument();
    expect(rows('Camera init')).toHaveLength(1);

    // Its folder still holds the unpinned sibling, so opening it must not turn up the pinned row again.
    fireEvent.click(await row('Snack Sorter'));
    expect(rows('Classifier tuning')).toHaveLength(1);
    expect(rows('Camera init')).toHaveLength(1);
  });

  // A draft has no row of its own, so nothing resolves its folder — the tree must not shut on every "New chat".
  it('keeps the folder expanded when the open session is a draft with no row', async () => {
    useChatStore.setState({ currentSessionId: 's3' });
    renderPanel();

    expect(await row('Wind readings')).toBeInTheDocument();

    await act(async () => {
      useChatStore.setState({ currentSessionId: 'draft-1' });
    });

    expect(rows('Wind readings')).toHaveLength(1);
  });

  // A folder is the grouping itself, so the last session leaving it takes the row with it.
  it('drops a folder once it has no sessions', async () => {
    vi.mocked(listSessions).mockResolvedValue([sessions[3]]);
    renderPanel();

    expect(await row('Arduino Apps')).toBeInTheDocument();
    expect(rows('Snack Sorter')).toHaveLength(0);
  });

  // An empty chat has no session, so no current id: New session is the entry it has open.
  it('selects New session with no current session on an agent that creates it on the first prompt', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    useAiAssistantStore
      .getState()
      .setAuth('opencode', { authenticated: true, agentId: 'opencode' });
    renderPanel();

    const entry = await row('New session');
    expect(entry.closest('[aria-current="page"]')).not.toBeNull();
  });

  // A title the engine writes after the turn has ended reaches the row through a refetch.
  it('refetches its rows when a session gets its title late', async () => {
    renderPanel();
    await vi.waitFor(() => expect(listSessions).toHaveBeenCalled());
    const calls = vi.mocked(listSessions).mock.calls.length;

    act(() => {
      useChatStore.getState().touchSessionList();
    });

    await vi.waitFor(() =>
      expect(vi.mocked(listSessions).mock.calls.length).toBe(calls + 1),
    );
  });

  it('selects nothing with no current session on an agent that opens it at once', async () => {
    renderPanel();

    const entry = await row('New session');
    expect(entry.closest('[aria-current="page"]')).toBeNull();
  });
});

// The header of a panel showing the renamed session follows the sidebar; a blank title brings back the engine's.
describe('AgentSidePanel rename', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    vi.mocked(listSessions).mockResolvedValue(sessions);
    vi.mocked(renameSession).mockResolvedValue(undefined);
  });

  const rename = async (
    result: { current: ReturnType<typeof useAgentSidePanelLogic> },
    title: string,
  ): Promise<void> => {
    act(() => {
      result.current.startRename(sessions[0]);
      result.current.setDraftTitle(title);
    });
    await act(async () => {
      result.current.onRenameKeyDown(
        { key: 'Enter' } as React.KeyboardEvent,
        's1',
      );
    });
  };

  it('hands the new title to the panel showing the session', async () => {
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    await rename(result, 'Camera setup');

    expect(renameSession).toHaveBeenCalledWith('s1', 'Camera setup');
    expect(useChatStore.getState().retitled).toMatchObject({
      sessionId: 's1',
      title: 'Camera setup',
    });
  });

  it('hands back the engine title after a blank rename', async () => {
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() => expect(listSessions).toHaveBeenCalled());
    vi.mocked(listSessions).mockResolvedValue([
      { ...sessions[0], title: 'Camera init on the Uno Q' },
    ]);

    await rename(result, '  ');

    expect(renameSession).toHaveBeenCalledWith('s1', '');
    expect(useChatStore.getState().retitled).toMatchObject({
      sessionId: 's1',
      title: 'Camera init on the Uno Q',
    });
  });
});

// The host deletes a forgotten app's chats after it says so: a list read before it is done still has them.
describe('AgentSidePanel and a deleted app', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    vi.mocked(listSessions).mockResolvedValue(sessions);
  });

  const forget = (appId: string, chatIds?: string[]): void =>
    act(() => forgottenHandlers.forEach((handler) => handler(appId, chatIds)));
  const ids = (logic: ReturnType<typeof useAgentSidePanelLogic>): string[] =>
    [...logic.pinnedSessions, ...logic.folders.flatMap((f) => f.sessions)]
      .map((s) => s.id)
      .sort();

  it("drops the app's chats at once, also from a read the host answers before it is done", async () => {
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() =>
      expect(ids(result.current)).toEqual(['s1', 's2', 's3', 's4']),
    );
    const reads = vi.mocked(listSessions).mock.calls.length;

    forget('snack');

    expect(ids(result.current)).toEqual(['s3', 's4']);
    await waitFor(() =>
      expect(vi.mocked(listSessions).mock.calls.length).toBe(reads + 1),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(ids(result.current)).toEqual(['s3', 's4']);
  });

  // That chat stays, about no app, as the host keeps it.
  it('keeps the chat whose turn deleted the app, in the general folder', async () => {
    useChatStore.getState().beginTurn('s1');
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() => expect(ids(result.current)).toHaveLength(4));

    forget('snack');

    await waitFor(() =>
      expect(ids(result.current)).toEqual(['s1', 's3', 's4']),
    );
    const general = result.current.folders.find((f) => f.appId === '');
    expect(general?.sessions.map((s) => s.id).sort()).toEqual(['s1', 's4']);
  });

  // A sweep keeps a legacy chat with no board on the app: only the chats the host names go.
  it('hides exactly the chats the host names, a running one shown unbound', async () => {
    useChatStore.getState().beginTurn('s1');
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() => expect(ids(result.current)).toHaveLength(4));
    const reads = vi.mocked(listSessions).mock.calls.length;

    forget('snack', ['s1', 's9-of-another-agent']);

    await waitFor(() =>
      expect(vi.mocked(listSessions).mock.calls.length).toBe(reads + 1),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(ids(result.current)).toEqual(['s1', 's2', 's3', 's4']);
    const snack = result.current.folders.find((f) => f.appId === 'snack');
    expect(snack?.sessions.map((s) => s.id)).toEqual(['s2']);
    const general = result.current.folders.find((f) => f.appId === '');
    expect(general?.sessions.map((s) => s.id).sort()).toEqual(['s1', 's4']);

    useChatStore.getState().endTurn('s1');
    forget('weather', []);
    expect(ids(result.current)).toEqual(['s1', 's2', 's3', 's4']);
    forget('weather', ['s3']);
    expect(ids(result.current)).toEqual(['s1', 's2', 's4']);
  });

  // A live app can have the deleted one's id (created again, or on another board): its chats show while the host still lists the old ones.
  it('hides only the chats the forget named, not every chat of that app id', async () => {
    const { result } = renderHook(() => useAgentSidePanelLogic('Arduino Apps'));
    await waitFor(() => expect(ids(result.current)).toHaveLength(4));
    forget('snack');
    await waitFor(() => expect(ids(result.current)).toEqual(['s3', 's4']));

    vi.mocked(listSessions).mockResolvedValue([
      ...sessions,
      { id: 's9', title: 'New snack chat', workspaceAppId: 'snack' },
    ]);
    act(() => useChatStore.getState().touchSessionList());

    await waitFor(() =>
      expect(ids(result.current)).toEqual(['s3', 's4', 's9']),
    );
  });
});
