import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentRestart, SessionState } from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { useAiAssistantPanelLogic } from './AiAssistantPanel.logic';

const services = vi.hoisted(() => ({
  getAuthStatus: vi.fn<() => Promise<unknown>>(),
  start: vi.fn<(agentId: string) => Promise<void>>(),
  validateAuth: vi.fn<() => Promise<SessionState>>(),
  restartListeners: [] as ((restart: AgentRestart) => void)[],
}));

vi.mock('../../services', () => ({
  DEFAULT_AGENT_ID: 'claude',
  listAgents: (): { id: string; comingSoon?: boolean }[] => [{ id: 'claude' }],
  getAuthStatus: services.getAuthStatus,
  // The host names the agent in use; the probe reflects it rather than picking one.
  currentAgent: (): Promise<string> => Promise.resolve('claude'),
  start: services.start,
  validateAuth: services.validateAuth,
  onRestart: (fn: (restart: AgentRestart) => void): VoidFunction => {
    services.restartListeners.push(fn);
    return (): void => {
      services.restartListeners = services.restartListeners.filter(
        (l) => l !== fn,
      );
    };
  },
  isAuthError: (): boolean => false,
  parseAgentError: (): { message: string } => ({ message: '' }),
}));

const emitRestart = (restart: AgentRestart): void =>
  act(() => services.restartListeners.forEach((l) => l(restart)));

// The loader the panel shows over the chat is driven entirely by this hook, and it has no timeout —
// whatever leaves `loading` true keeps the user out of the chat until App Lab is restarted.
describe('useAiAssistantPanelLogic', () => {
  beforeEach(() => {
    services.getAuthStatus.mockReset().mockResolvedValue({
      authenticated: true,
      agentId: 'claude',
    });
    services.start.mockReset().mockResolvedValue(undefined);
    services.validateAuth.mockReset().mockResolvedValue({
      sessionId: 'probe',
      status: 'idle',
    });
    services.restartListeners = [];
    useChatStore.getState().reset();
    useAiAssistantStore.setState({
      selectedAgentId: undefined,
      auth: {},
      authResolved: false,
      lastValidatedAt: undefined,
      agentDown: undefined,
    });
  });

  // Signing in from Settings marks the credential fresh without this panel ever mounting, so the
  // first open takes the skip-the-probe path with authResolved still false — which used to hang.
  it('clears the loader on a first open that follows a sign-in made from Settings', async () => {
    useAiAssistantStore.setState({
      selectedAgentId: 'claude',
      auth: { claude: { authenticated: true, agentId: 'claude' } },
      authResolved: false,
      lastValidatedAt: Date.now(),
    });

    const { result } = renderHook(() => useAiAssistantPanelLogic());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authenticated).toBe(true);
    expect(services.getAuthStatus).not.toHaveBeenCalled(); // still trusts the fresh credential
  });

  it('probes and resolves when no validation is on record', async () => {
    const { result } = renderHook(() => useAiAssistantPanelLogic());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authenticated).toBe(true);
    expect(services.validateAuth).toHaveBeenCalled();
  });

  // With sessions created on the first prompt, nothing else refreshes the sidebar after the start or fills the empty chat's pickers.
  it('re-reads the session list after the start and seeds the empty chat from the validation session', async () => {
    services.validateAuth.mockResolvedValue({
      sessionId: 'probe',
      status: 'idle',
      modelId: 'opencode/big-pickle',
      models: [{ id: 'opencode/big-pickle', name: 'Big Pickle' }],
      modeId: 'build',
      modes: [{ id: 'build', name: 'build' }],
    });
    const listVersion = useChatStore.getState().sessionListVersion;

    const { result } = renderHook(() => useAiAssistantPanelLogic());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(useChatStore.getState().sessionListVersion).toBeGreaterThan(
      listVersion,
    );
    expect(useChatStore.getState().newSessionPicks).toEqual({
      modelId: 'opencode/big-pickle',
      modeId: 'build',
    });
    expect(
      useAiAssistantStore.getState().pickers?.models.map((m) => m.id),
    ).toEqual(['opencode/big-pickle']);
  });

  // Past the freshness window the credential is re-probed, and an expired one has to reach the login
  // screen rather than the chat.
  it('re-validates a stale credential and drops to connect when the probe says signed out', async () => {
    services.getAuthStatus.mockResolvedValue({ authenticated: false });
    useAiAssistantStore.setState({
      selectedAgentId: 'claude',
      auth: { claude: { authenticated: true, agentId: 'claude' } },
      authResolved: false,
      lastValidatedAt: Date.now() - 3_600_000,
    });

    const { result } = renderHook(() => useAiAssistantPanelLogic());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authenticated).toBe(false);
  });

  // The session list is scoped to the connected board and app ids repeat across boards, so a pointer kept
  // across a switch reopens the previous board's chat under a row the sidebar no longer lists.
  it('forgets the session to reopen when the agent went down for a board switch', async () => {
    const { result } = renderHook(() => useAiAssistantPanelLogic());
    await waitFor(() => expect(result.current.loading).toBe(false));
    useChatStore
      .getState()
      .setLastSession('s1', 'Camera init', { id: 'snack' });

    emitRestart({ attempt: 3, max: 3, gaveUp: true, reason: 'board-changed' });

    expect(useChatStore.getState().lastSessionId).toBeNull();
    expect(useChatStore.getState().lastSessionByWorkspace).toEqual({});
  });

  // A flash leaves the board in place but wipes the apps its chats are scoped to, so the pointers are as
  // dead as after a switch. The prompt has to say reflashed, not changed.
  it('forgets the session and names the reflash when the board was flashed', async () => {
    const { result } = renderHook(() => useAiAssistantPanelLogic());
    await waitFor(() => expect(result.current.loading).toBe(false));
    useChatStore
      .getState()
      .setLastSession('s1', 'Camera init', { id: 'snack' });

    emitRestart({ attempt: 3, max: 3, gaveUp: true, reason: 'board-flashed' });

    expect(useChatStore.getState().lastSessionId).toBeNull();
    await waitFor(() =>
      expect(result.current.agentDownReason).toBe('board-flashed'),
    );
  });

  // A crash comes back to the same board, so the chat the user was in is still theirs to resume.
  it('keeps it when the agent merely crashed', async () => {
    const { result } = renderHook(() => useAiAssistantPanelLogic());
    await waitFor(() => expect(result.current.loading).toBe(false));
    useChatStore
      .getState()
      .setLastSession('s1', 'Camera init', { id: 'snack' });

    emitRestart({ attempt: 3, max: 3, gaveUp: true });

    expect(useChatStore.getState().lastSessionId).toBe('s1');
    expect(useChatStore.getState().lastSessionByWorkspace['snack']?.id).toBe(
      's1',
    );
  });
});
