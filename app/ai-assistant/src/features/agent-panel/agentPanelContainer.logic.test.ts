import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionSummary } from '../../services';
import { useChatStore } from '../../store';
import { useAgentPanelContainerLogic } from './agentPanelContainer.logic';

const services = vi.hoisted(() => ({
  getAuthStatus: vi.fn<() => Promise<unknown>>(),
  start: vi.fn<(agentId: string) => Promise<void>>(),
  listSessions: vi.fn<() => Promise<SessionSummary[]>>(),
}));

vi.mock('../../services', () => ({
  listAgents: (): { id: string; comingSoon?: boolean }[] => [{ id: 'claude' }],
  getAuthStatus: services.getAuthStatus,
  currentAgent: (): Promise<string> => Promise.resolve('claude'),
  start: services.start,
  listSessions: services.listSessions,
}));

const session = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 's1',
  workspaceAppId: 'app-1',
  ...overrides,
});

describe('useAgentPanelContainerLogic', () => {
  beforeEach(() => {
    services.getAuthStatus
      .mockReset()
      .mockResolvedValue({ authenticated: false });
    services.start.mockReset().mockResolvedValue(undefined);
    services.listSessions.mockReset().mockResolvedValue([]);
    useChatStore.getState().reset();
  });

  // This is the bug fix: the history picker used to call sessionDotState with only
  // currentSessionId, so a session that just got a reply looked identical to any other idle one.
  it('reports replyReady for a background session once the store marks its reply ready', async () => {
    services.listSessions.mockResolvedValue([
      session({ id: 's1' }),
      session({ id: 's2' }),
    ]);
    useChatStore.setState({
      currentSessionId: 's1',
      replyReadySessions: { s2: true },
    });

    const { result } = renderHook(() => useAgentPanelContainerLogic('app-1'));

    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.dotState(session({ id: 's2' }))).toBe('replyReady');
    expect(result.current.dotState(session({ id: 's1' }))).toBe('active');
  });

  it('reports typing for a session the store marks as streaming', async () => {
    services.listSessions.mockResolvedValue([session({ id: 's1' })]);
    useChatStore.setState({ streamingSessions: { s1: true } });

    const { result } = renderHook(() => useAgentPanelContainerLogic('app-1'));

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.dotState(session({ id: 's1' }))).toBe('typing');
  });

  it('has no unread badge when nothing is reply-ready', async () => {
    services.listSessions.mockResolvedValue([session({ id: 's1' })]);

    const { result } = renderHook(() => useAgentPanelContainerLogic('app-1'));

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.hasUnread).toBe(false);
  });

  it('flags unread when a session other than the current one has an unseen reply', async () => {
    services.listSessions.mockResolvedValue([
      session({ id: 's1' }),
      session({ id: 's2' }),
    ]);
    useChatStore.setState({
      currentSessionId: 's1',
      replyReadySessions: { s2: true },
    });

    const { result } = renderHook(() => useAgentPanelContainerLogic('app-1'));

    await waitFor(() => expect(result.current.hasUnread).toBe(true));
  });

  // markReplyReady never fires for the session already on screen, but this guards the "clears once
  // opened" contract at this hook's boundary too: an unseen reply for the *current* session must not
  // badge the history button that is right above it.
  it('does not flag unread for the current session even if it is marked reply-ready', async () => {
    services.listSessions.mockResolvedValue([session({ id: 's1' })]);
    useChatStore.setState({
      currentSessionId: 's1',
      replyReadySessions: { s1: true },
    });

    const { result } = renderHook(() => useAgentPanelContainerLogic('app-1'));

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.hasUnread).toBe(false);
  });
});
