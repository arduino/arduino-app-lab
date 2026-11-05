import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentUpdate,
  PermissionRequest,
  SessionState,
} from '../../../services';
import {
  estimateOutputTokens,
  subscribeAgentStream,
  subscribeWorkspaceAppForgotten,
  useAiAssistantStore,
  useChatStore,
} from '../../../store';
import { type ChatPanelLogic, useChatLogic } from './ChatPanel.logic';
import { permissionView } from './utils/permissionView';

// The whole service layer, so the hook runs against fakes instead of a Wails-backed agent. The
// update handler is kept: the store subscribes to it, and this is how a test streams a turn in.
const updateHandlers = vi.hoisted(
  (): ((sessionId: string, update: AgentUpdate) => void)[] => [],
);
const renameHandlers = vi.hoisted(
  (): ((oldId: string, newId: string, newName: string) => void)[] => [],
);
const forgottenHandlers = vi.hoisted((): ((appId: string) => void)[] => []);
const services = vi.hoisted(() => ({
  newSession: vi.fn<(appId?: string, appName?: string) => Promise<string>>(),
  getSessionState: vi.fn<() => Promise<unknown>>(),
  listSessions: vi.fn<() => Promise<unknown[]>>(),
  prompt: vi.fn<() => Promise<void>>(),
  loadSession: vi.fn<() => Promise<void>>(),
  closeSession: vi.fn<() => Promise<void>>(),
  setSessionModel: vi.fn<() => Promise<void>>(),
  setSessionMode: vi.fn<() => Promise<void>>(),
  newSessionState: vi.fn<() => Promise<SessionState>>(),
  awaitTurn: vi.fn<(sessionId: string) => Promise<void>>(),
}));

vi.mock('../../../services', async () => ({
  ...(await vi.importActual<typeof import('../../../services/agentErrors')>(
    '../../../services/agentErrors',
  )),
  newSession: services.newSession,
  getSessionState: services.getSessionState,
  listSessions: services.listSessions,
  prompt: services.prompt,
  loadSession: services.loadSession,
  closeSession: services.closeSession,
  setSessionModel: services.setSessionModel,
  setSessionMode: services.setSessionMode,
  newSessionState: services.newSessionState,
  awaitTurn: services.awaitTurn,
  cancel: vi.fn(),
  openAgentFile: vi.fn(),
  permissionReply: vi.fn(),
  choicesReply: vi.fn(),
  onUpdate: (
    handler: (sessionId: string, update: AgentUpdate) => void,
  ): VoidFunction => {
    updateHandlers.push(handler);
    return () => updateHandlers.splice(updateHandlers.indexOf(handler), 1);
  },
  onPermission: (): VoidFunction => vi.fn(),
  onRestart: (): VoidFunction => vi.fn(),
  onWorkspaceAppForgotten: (handler: (appId: string) => void): VoidFunction => {
    forgottenHandlers.push(handler);
    return () =>
      forgottenHandlers.splice(forgottenHandlers.indexOf(handler), 1);
  },
  onWorkspaceAppRenamed: (
    handler: (oldId: string, newId: string, newName: string) => void,
  ): VoidFunction => {
    renameHandlers.push(handler);
    return () => renameHandlers.splice(renameHandlers.indexOf(handler), 1);
  },
  getAgent: (
    id?: string,
  ): { persistsNewSession: boolean; perProviderKeys: boolean } | undefined =>
    id === 'opencode'
      ? { persistsNewSession: true, perProviderKeys: true }
      : undefined,
}));

// Only isOffline is stubbed: the rest of utils is real, and the bootstrap reads a session title through it.
vi.mock('../../../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils')>()),
  isOffline: (): boolean => false,
}));

const sessionState = (): SessionState => ({
  sessionId: 'sess-1',
  status: 'idle',
  models: [
    { id: 'opus', name: 'Opus 5' },
    { id: 'fable', name: 'Fable 5' },
  ],
  modelId: 'opus',
  modes: [{ id: 'build', name: 'Build' }],
  modeId: 'build',
});

// Enter only queues the prompt and the turn runs on its own, so a test waits until that turn has ended.
const sendAndSettle = async (
  result: { current: ChatPanelLogic },
  text: string,
): Promise<void> => {
  const sent = services.prompt.mock.calls.length;
  act(() => result.current.enqueue(text));
  await waitFor(() => {
    expect(services.prompt.mock.calls.length).toBeGreaterThan(sent);
    expect(useChatStore.getState().streamingSessions).toEqual({});
  });
};

describe('useChatLogic', () => {
  let unsubscribe: VoidFunction | undefined;

  beforeEach(() => {
    useChatStore.getState().reset();
    useAiAssistantStore.setState({
      pickers: undefined,
      selectedAgentId: undefined,
    });
    useChatStore.getState().chatOwners.forEach(({ id }) => {
      useChatStore.getState().releaseChat(id);
    });
    services.newSession.mockReset().mockResolvedValue('sess-1');
    services.getSessionState.mockReset().mockResolvedValue(sessionState());
    services.listSessions.mockReset().mockResolvedValue([]);
    services.prompt.mockReset().mockResolvedValue(undefined);
    services.loadSession.mockReset().mockResolvedValue(undefined);
    services.closeSession.mockReset().mockResolvedValue(undefined);
    services.setSessionModel.mockReset().mockResolvedValue(undefined);
    services.setSessionMode.mockReset().mockResolvedValue(undefined);
    services.newSessionState.mockReset().mockResolvedValue(sessionState());
    services.awaitTurn.mockReset().mockResolvedValue(undefined);
    unsubscribe?.();
    updateHandlers.length = 0;
    renameHandlers.length = 0;
    forgottenHandlers.length = 0;
    unsubscribe = subscribeAgentStream();
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
  });

  // A prompt sent while the engine is replaced reaches none, and the reset after the restart drops it from the thread.
  it('holds Send while the agent restarts with a new key, and not while it waits for a turn', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.canCompose).toBe(true));

    act(() => {
      useAiAssistantStore.setState({
        credentialRestart: { agentId: 'claude', phase: 'waiting' },
      });
    });
    expect(result.current.canCompose).toBe(true);

    act(() => {
      useAiAssistantStore.setState({
        credentialRestart: { agentId: 'claude', phase: 'restarting' },
      });
    });
    expect(result.current.canCompose).toBe(false);

    act(() => {
      useAiAssistantStore.setState({ credentialRestart: undefined });
    });
    expect(result.current.canCompose).toBe(true);
  });

  it('holds Retry while the agent restarts with a new key', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(new Error('the engine gave up'));
    await sendAndSettle(result, 'Blink an LED on D13');
    const failed = result.current.requestError?.messageId ?? '';

    act(() => {
      useAiAssistantStore.setState({
        credentialRestart: { agentId: 'claude', phase: 'restarting' },
      });
    });
    try {
      await act(async () => {
        await result.current.retry(failed);
      });

      expect(services.prompt).toHaveBeenCalledTimes(1);
      expect(result.current.requestError?.messageId).toBe(failed);
    } finally {
      useAiAssistantStore.setState({ credentialRestart: undefined });
    }
  });

  // Without the session's own state nothing would ever name its model: the menu has to open anyway.
  it('lets the user pick a model when the session could not report its own', async () => {
    useAiAssistantStore.getState().setPickers({
      models: [{ id: 'opus', name: 'Opus 5' }],
      modes: [],
    });
    services.getSessionState.mockRejectedValue(new Error('agent not started'));
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    await waitFor(() => expect(result.current.modelUnreadable).toBe(true));
    expect(result.current.currentModelId).toBeUndefined();
    expect(result.current.models.map((m) => m.id)).toEqual(['opus']);
  });

  // A key change or a Reconnect drops the threads; the chat that failed must still say so after it comes back.
  it('keeps the failure banner of the open chat across an engine restart', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(new Error('peer disconnected'));
    await sendAndSettle(result, 'Blink an LED on D13');
    services.loadSession.mockImplementation(async () => {
      updateHandlers.forEach((handler) =>
        handler('sess-1', {
          type: 'user_message',
          delta: 'Blink an LED on D13',
        }),
      );
    });

    act(() => useChatStore.getState().resetLoadedSessions());

    await waitFor(() =>
      expect(result.current.requestError).toMatchObject({ kind: 'replayed' }),
    );
    expect(services.loadSession).toHaveBeenCalledWith('sess-1');
  });

  it('opens the next session on the id an agent rename gives the workspace', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.newSession.mockResolvedValue('sess-2');
    act(() => result.current.selectWorkspace('old-id', 'Old name'));
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-2'));

    act(() =>
      renameHandlers.forEach((handler) =>
        handler('old-id', 'new-id', 'New name'),
      ),
    );
    expect(result.current.workspaceId).toBe('new-id');
    expect(result.current.workspaceName).toBe('New name');

    services.newSession.mockResolvedValue('sess-3');
    act(() => result.current.newChat());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-3'));
    expect(services.newSession).toHaveBeenLastCalledWith('new-id', 'New name');
  });

  // The editor's side panel stays mounted through the rename and then gets the new id from its page.
  it('keeps a locked panel on its session when the agent renames its app', async () => {
    const { result, rerender } = renderHook(
      ({ id, name }) => useChatLogic(id, name),
      { initialProps: { id: 'old-id', name: 'Old name' } },
    );
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.newSession.mockResolvedValue('sess-2');

    act(() =>
      renameHandlers.forEach((handler) =>
        handler('old-id', 'new-id', 'New name'),
      ),
    );
    rerender({ id: 'new-id', name: 'New name' });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(result.current.currentSessionId).toBe('sess-1');
    expect(result.current.workspaceId).toBe('new-id');
    expect(services.newSession).toHaveBeenCalledTimes(1);
    expect(services.closeSession).not.toHaveBeenCalled();
  });

  // The host keeps the chat whose turn deleted its app, about no app: the panel stays on it, on the whole board.
  it('stays on a chat whose running turn deleted its app', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.newSession.mockResolvedValue('sess-2');
    act(() => result.current.selectWorkspace('app-1', 'Blink'));
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-2'));
    let endTurn: VoidFunction = () => undefined;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          endTurn = resolve;
        }),
    );
    act(() => result.current.enqueue('Delete this app with apps_delete'));
    await waitFor(() =>
      expect(useChatStore.getState().streamingSessions['sess-2']).toBe(true),
    );
    const stopForgetting = subscribeWorkspaceAppForgotten();

    try {
      act(() => forgottenHandlers.forEach((handler) => handler('app-1')));
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(result.current.currentSessionId).toBe('sess-2');
      expect(result.current.workspaceId).toBe('');
      expect(services.newSession).toHaveBeenCalledTimes(2);
      expect(services.closeSession).not.toHaveBeenCalledWith('sess-2');
    } finally {
      stopForgetting();
      endTurn();
    }
    await waitFor(() =>
      expect(useChatStore.getState().streamingSessions).toEqual({}),
    );
  });

  // Agent Mode makes a chat of another workspace the last one; the editor's panel still comes back to its app's.
  it("reopens its app's chat after an agent rename and a trip to Agent Mode", async () => {
    const docked = renderHook(() => useChatLogic('old-id', 'Old name'));
    await waitFor(() =>
      expect(docked.result.current.currentSessionId).toBe('sess-1'),
    );
    await sendAndSettle(docked.result, 'Rename this app');
    // The store follows the rename from its own startup subscription.
    act(() => {
      useChatStore.getState().rebindWorkspace('old-id', 'new-id', 'New name');
      renameHandlers.forEach((handler) =>
        handler('old-id', 'new-id', 'New name'),
      );
    });
    docked.unmount();

    services.newSession.mockResolvedValue('sess-2');
    const agentMode = renderHook(() => useChatLogic());
    await waitFor(() =>
      expect(agentMode.result.current.currentSessionId).toBe('sess-1'),
    );
    act(() => agentMode.result.current.selectWorkspace(''));
    await waitFor(() =>
      expect(agentMode.result.current.currentSessionId).toBe('sess-2'),
    );
    agentMode.unmount();

    services.newSession.mockClear();
    const { result } = renderHook(() => useChatLogic('new-id', 'New name'));

    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    expect(services.newSession).not.toHaveBeenCalled();
    expect(useChatStore.getState().lastSessionByWorkspace['new-id']?.id).toBe(
      'sess-1',
    );
  });

  it('opens a session on mount and fills the toolbar from its state', async () => {
    const { result } = renderHook(() => useChatLogic());

    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    expect(services.newSession).toHaveBeenCalledTimes(1);
    expect(result.current.models.map((m) => m.id)).toEqual(['opus', 'fable']);
    expect(result.current.currentModelId).toBe('opus');
    expect(result.current.modes.map((m) => m.id)).toEqual(['build']);
    expect(result.current.currentModeId).toBe('build');
    expect(result.current.isNewSession).toBe(true);
  });

  // The cache of the previous session stands in for a LIST this one has not reported, so no picker
  // vanishes: ChatInput hides one whose list is empty, and a model_change landing before
  // getSessionState carries no modes at all. It never stands in for a PICK: ChatInput falls back to
  // the first item, and the 3s/12s re-advertise re-selects the pick, which would switch the model.
  it("takes lists from the cache, never another session's picks", async () => {
    useAiAssistantStore.getState().setPickers({
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [{ id: 'build', name: 'Build' }],
      currentModeId: 'build',
    });
    // Never resolves, so the session reports nothing but the model_change below.
    services.getSessionState.mockReturnValue(
      new Promise<never>(() => undefined),
    );

    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    expect(result.current.models.map((m) => m.id)).toEqual(['opus']);
    expect(result.current.modes.map((m) => m.id)).toEqual(['build']);
    expect(result.current.currentModelId).toBeUndefined();
    expect(result.current.currentModeId).toBeUndefined();

    act(() => {
      updateHandlers.forEach((handler) =>
        handler('sess-1', {
          type: 'model_change',
          models: [{ id: 'fable', name: 'Fable 5' }],
        }),
      );
    });

    expect(result.current.models.map((m) => m.id)).toEqual(['fable']);
    expect(result.current.modes.map((m) => m.id)).toEqual(['build']);
    expect(result.current.currentModelId).toBeUndefined();
  });

  // The reviewer's repro, end to end: a model advertised while getSessionState is in flight survives
  // a cold catalog coming back, on the thread and in the cache the next session is seeded from.
  it('keeps a model advertised mid-hydrate, on the thread and in the cache', async () => {
    let reportState: (state: SessionState) => void = () => undefined;
    services.getSessionState.mockReturnValue(
      new Promise<SessionState>((resolve) => {
        reportState = resolve;
      }),
    );

    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    act(() => {
      updateHandlers.forEach((handler) =>
        handler('sess-1', {
          type: 'model_change',
          models: [
            { id: 'opus', name: 'Opus 5' },
            { id: 'fable', name: 'Fable 5' },
          ],
        }),
      );
    });
    expect(result.current.models.map((m) => m.id)).toEqual(['opus', 'fable']);

    await act(async () => {
      reportState({
        sessionId: 'sess-1',
        status: 'idle',
        models: [{ id: 'opus', name: 'Opus 5' }], // the cold read
        modelId: 'opus',
        modes: [{ id: 'build', name: 'Build' }],
        modeId: 'build',
      });
    });

    expect(result.current.models.map((m) => m.id)).toEqual(['opus', 'fable']);
    expect(result.current.currentModelId).toBe('opus');
    expect(
      useAiAssistantStore.getState().pickers?.models.map((m) => m.id),
    ).toEqual(['opus', 'fable']);
  });

  it('puts a prompt in the thread and clears the turn when it settles', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    await act(async () => {
      result.current.enqueue('Blink an LED on D13');
    });

    expect(services.prompt).toHaveBeenCalledWith(
      'sess-1',
      'Blink an LED on D13',
      undefined,
    );
    expect(result.current.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(result.current.isStreaming).toBe(false);
    expect(useChatStore.getState().streamingSessions).toEqual({});
  });

  // Read at send time, so the agent gets the editor as it is when the user asks; the thread shows the text alone.
  it('sends what the editor holds with the prompt, and shows only the text', async () => {
    const editor = {
      file: {
        path: 'python/main.py',
        content: 'if a == True:\n    blink()\n',
        unsaved: false,
      },
      selection: {
        path: 'python/main.py',
        startLine: 1,
        endLine: 1,
        text: 'if a == True:',
      },
    };
    const getEditorContext = vi.fn(() => editor);
    const { result } = renderHook(() =>
      useChatLogic('app-1', 'Blink', true, getEditorContext),
    );
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    expect(getEditorContext).not.toHaveBeenCalled();

    await act(async () => {
      result.current.enqueue('What does this code do?');
    });

    expect(services.prompt).toHaveBeenCalledWith(
      'sess-1',
      'What does this code do?',
      editor,
    );
    const [message] = result.current.messages;
    expect(message?.parts).toEqual([
      { type: 'text', id: expect.any(String), text: 'What does this code do?' },
    ]);
  });

  // A prompt typed mid-turn waits above the composer and reaches the thread only when its turn comes.
  it('queues a prompt while a turn runs and sends it when that turn ends', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    let settle!: () => void;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );

    act(() => {
      result.current.enqueue('first');
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => result.current.enqueue('second'));
    expect(result.current.queuedPrompts.map((p) => p.text)).toEqual(['second']);
    // Queued, so it is not in the thread and the agent has not seen it.
    expect(services.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);

    await act(async () => {
      settle();
    });

    await waitFor(() =>
      expect(services.prompt).toHaveBeenCalledWith(
        'sess-1',
        'second',
        undefined,
      ),
    );
    expect(result.current.queuedPrompts).toEqual([]);
  });

  // A failed turn drops the queue, as Stop does: rows nothing will send must not sit above the composer.
  it('drops the queue when the turn fails', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    let fail!: () => void;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = (): void => reject(new Error('the agent went away'));
        }),
    );

    act(() => {
      result.current.enqueue('first');
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => result.current.enqueue('second'));

    await act(async () => {
      fail();
    });

    expect(result.current.queuedPrompts).toEqual([]);
    expect(services.prompt).toHaveBeenCalledTimes(1);
  });

  // Stop is a decision about everything pending, not only the turn on screen.
  it('drops the queue when the user stops the turn', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    let settle!: () => void;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );

    act(() => {
      result.current.enqueue('first');
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => result.current.enqueue('second'));

    await act(async () => {
      await result.current.stop();
      settle();
    });

    expect(result.current.queuedPrompts).toEqual([]);
    expect(services.prompt).toHaveBeenCalledTimes(1);
  });

  // The stopped turn still ends like a success, and what was typed after Stop is a new request.
  it('sends a prompt typed after Stop once the stopped turn ends', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    let settle!: () => void;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );

    act(() => result.current.enqueue('first'));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => result.current.enqueue('dropped'));

    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.enqueue('after stop'));
    expect(result.current.queuedPrompts.map((p) => p.text)).toEqual([
      'after stop',
    ]);

    await act(async () => {
      settle();
    });

    await waitFor(() =>
      expect(services.prompt).toHaveBeenLastCalledWith(
        'sess-1',
        'after stop',
        undefined,
      ),
    );
    expect(services.prompt).not.toHaveBeenCalledWith(
      'sess-1',
      'dropped',
      undefined,
    );
  });

  // What the user types after a failure is what they want sent, not a row the failure dropped.
  it('sends the prompt typed after a failed turn', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    let fail!: () => void;
    services.prompt.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = (): void => reject(new Error('the agent went away'));
        }),
    );

    act(() => result.current.enqueue('first'));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => result.current.enqueue('second'));

    await act(async () => {
      fail();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    act(() => result.current.enqueue('third'));

    expect(services.prompt).toHaveBeenLastCalledWith(
      'sess-1',
      'third',
      undefined,
    );
    expect(services.prompt).not.toHaveBeenCalledWith(
      'sess-1',
      'second',
      undefined,
    );
    expect(result.current.queuedPrompts).toEqual([]);
  });

  // A switch is one bump now, and its own test holds that; two bumps mean two reopenings, as they should.
  it('opens one session for one reset of the chat', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.newSession.mockClear();
    services.newSession.mockResolvedValue('sess-2');

    await act(async () => {
      useChatStore.getState().reset();
    });
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-2'));

    expect(services.newSession).toHaveBeenCalledTimes(1);
  });

  // The composer and the Settings barrier read these flags, and would stay shut until a remount.
  it('clears the turn when the prompt fails', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValue(new Error('the engine gave up'));

    await sendAndSettle(result, 'Blink an LED on D13');

    expect(result.current.isStreaming).toBe(false);
    expect(useChatStore.getState().streamingSessions).toEqual({});
    expect(result.current.requestError?.message).toContain(
      'the engine gave up',
    );
  });

  // Two resets one await apart opened two sessions six milliseconds apart; the later bump must wait.
  it('opens one session when a second reset lands mid-open', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    const pending: ((id: string) => void)[] = [];
    let inFlight = 0;
    let peak = 0;
    services.newSession.mockReset().mockImplementation(() => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise<string>((resolve) => {
        pending.push((id: string) => {
          inFlight -= 1;
          resolve(id);
        });
      });
    });

    act(() => {
      useChatStore.getState().reset();
    });
    await waitFor(() => expect(pending).toHaveLength(1));

    // The second bump, while the first open is still waiting on the host.
    act(() => {
      useChatStore.getState().reset();
    });
    expect(pending).toHaveLength(1);

    await act(async () => {
      pending[0]('sess-2');
    });

    expect(peak).toBe(1);
    expect(services.newSession).toHaveBeenCalledTimes(1);
    // The bump that landed mid-open still ran, and re-adopted that session instead of opening another.
    expect(services.loadSession.mock.calls).toEqual([['sess-2']]);
    expect(result.current.currentSessionId).toBe('sess-2');
    expect(useChatStore.getState().lastSessionId).toBe('sess-2');
  });

  // OpenCode names a session after the moment it was made, until its first turn gives it a real one.
  it('never shows the name the engine gives an unprompted session', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    await act(async () => {
      result.current.reopen({
        id: 'sess-9',
        title: 'New session - 2026-09-16T10:11:07.172Z',
      });
    });

    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-9'));
    expect(result.current.sessionTitle).toBeUndefined();
    expect(useChatStore.getState().lastSessionId).toBe('sess-9');
    expect(useChatStore.getState().lastSessionTitle).toBeUndefined();

    // The title the model writes is the real one and is shown as it is.
    await act(async () => {
      result.current.reopen({ id: 'sess-10', title: 'Blink an LED on D13' });
    });
    await waitFor(() =>
      expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
    );
    expect(useChatStore.getState().lastSessionTitle).toBe(
      'Blink an LED on D13',
    );
  });

  // The title is re-read when the turn settles, which is when the engine has named the session.
  it('keeps the placeholder out of the header when the turn settles', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.listSessions.mockResolvedValue([
      { id: 'sess-1', title: 'New session - 2026-09-16T10:11:07.172Z' },
    ]);

    await sendAndSettle(result, 'Blink an LED on D13');
    expect(result.current.sessionTitle).toBeUndefined();

    services.listSessions.mockResolvedValue([
      { id: 'sess-1', title: 'Blink an LED on D13' },
    ]);
    await sendAndSettle(result, 'again');
    await waitFor(() =>
      expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
    );
  });

  it('shows the cause of a bare internal error and keeps the user signed in', async () => {
    useAiAssistantStore.setState({ sessionExpired: false });
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(
      new Error(
        '{"code":-32603,"message":"Internal error","data":{"details":"Unexpected token at position 401"}}',
      ),
    );

    await act(async () => {
      result.current.enqueue('Change the app description');
    });

    await waitFor(() =>
      expect(result.current.requestError?.message).toBe(
        'Unexpected token at position 401',
      ),
    );
    expect(useAiAssistantStore.getState().sessionExpired).toBe(false);
  });

  // The panel reads what the store's single subscriber writes; nothing arrives through the hook.
  it('shows the content the store subscriber writes to its session', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    act(() => {
      updateHandlers.forEach((handler) =>
        handler('sess-1', { type: 'message_chunk', delta: 'Blinking D13' }),
      );
    });

    const [message] = result.current.messages;
    expect(message?.role).toBe('assistant');
    expect(message?.parts).toEqual([
      { type: 'text', id: `${message?.id}-t0`, text: 'Blinking D13' },
    ]);
    // The counter is our estimate of the output: no engine reports that figure while it writes.
    expect(result.current.turnTokens).toBe(
      estimateOutputTokens('Blinking D13'.length),
    );
  });

  it('shows no token count on a free model', async () => {
    services.getSessionState.mockResolvedValue({
      ...sessionState(),
      models: [{ id: 'opencode/big-pickle', name: 'Big Pickle', free: true }],
      modelId: 'opencode/big-pickle',
    });
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() =>
      expect(result.current.currentModelId).toBe('opencode/big-pickle'),
    );

    act(() => {
      updateHandlers.forEach((handler) =>
        handler('sess-1', { type: 'message_chunk', delta: 'Blinking D13' }),
      );
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.turnTokens).toBe(0);
  });

  // The session opens at once: a pick made before it exists has nowhere to go and is dropped.
  it('drops a pick made before the session opens', async () => {
    let openSession: (id: string) => void = () => undefined;
    services.newSession.mockReturnValue(
      new Promise<string>((resolve) => {
        openSession = resolve;
      }),
    );
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(services.newSession).toHaveBeenCalled());

    await act(async () => {
      await result.current.setModel('fable');
    });
    expect(result.current.currentModelId).toBeUndefined();

    await act(async () => {
      openSession('sess-1');
    });
    await waitFor(() => expect(result.current.currentModelId).toBe('opus'));
    expect(services.setSessionModel).not.toHaveBeenCalled();
  });

  // Claude lists the first prompt as the title until it has written its own, which can land after the turn.
  it('replaces the prompt shown as a title with the one the engine writes', async () => {
    services.listSessions.mockResolvedValue([
      { id: 'sess-1', title: 'Blink an LED on D13' },
    ]);
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await sendAndSettle(result, 'Blink an LED on D13');
      await waitFor(() =>
        expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
      );

      services.listSessions.mockResolvedValue([
        { id: 'sess-1', title: 'LED blink on pin 13' },
      ]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      await waitFor(() =>
        expect(result.current.sessionTitle).toBe('LED blink on pin 13'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops asking for the title once the panel unmounts', async () => {
    services.listSessions.mockResolvedValue([
      { id: 'sess-1', title: 'New session - 2026-09-16T10:11:07.172Z' },
    ]);
    const { result, unmount } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await sendAndSettle(result, 'Blink an LED on D13');
      const calls = services.listSessions.mock.calls.length;

      unmount();
      await vi.advanceTimersByTimeAsync(70000);

      expect(services.listSessions.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends nothing before the session opens', async () => {
    services.newSession.mockReturnValue(new Promise<string>(() => undefined));
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(services.newSession).toHaveBeenCalled());

    await act(async () => {
      result.current.enqueue('Blink an LED on D13');
    });

    expect(services.newSession).toHaveBeenCalledTimes(1);
    expect(services.prompt).not.toHaveBeenCalled();
  });

  // After a reload the host still runs the turn: the reopened chat follows it as if it had been sent here.
  it('follows a turn the host still runs for a session reopened after a reload', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    let finishTurn: VoidFunction = () => undefined;
    services.awaitTurn.mockReturnValue(
      new Promise<void>((resolve) => {
        finishTurn = resolve;
      }),
    );
    services.getSessionState.mockResolvedValue({
      ...sessionState(),
      sessionId: 'sess-9',
      status: 'streaming',
      pendingPermission: {
        id: 'perm-1',
        sessionId: 'sess-9',
        options: [{ id: 'allow', label: 'Allow', kind: 'allow_once' }],
      },
    });
    services.loadSession.mockImplementation(async () => {
      const fire = (update: AgentUpdate): void =>
        updateHandlers.forEach((handler) => handler('sess-9', update));
      fire({ type: 'replay_start' });
      fire({ type: 'user_message', delta: 'Count to 1500' });
      fire({ type: 'message_chunk', delta: '1 2 3' });
    });

    await act(async () => {
      result.current.reopen({ id: 'sess-9', title: 'Counting' });
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    expect(services.awaitTurn).toHaveBeenCalledWith('sess-9');
    expect(result.current.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(result.current.permission).toBeDefined();

    act(() => result.current.enqueue('Say hi'));
    expect(result.current.queuedPrompts.map((p) => p.text)).toEqual(['Say hi']);
    expect(services.prompt).not.toHaveBeenCalled();

    await act(async () => {
      finishTurn();
    });
    await waitFor(() =>
      expect(services.prompt).toHaveBeenCalledWith(
        'sess-9',
        'Say hi',
        undefined,
      ),
    );
    expect(result.current.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('shows the failure of a turn it followed after a reload, with Retry', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.awaitTurn.mockRejectedValue(
      new Error(
        '{"code":-32603,"message":"Internal error","data":{"error":"peer disconnected before response"}}',
      ),
    );
    services.getSessionState.mockResolvedValue({
      ...sessionState(),
      sessionId: 'sess-9',
      status: 'streaming',
    });
    services.loadSession.mockImplementation(async () => {
      updateHandlers.forEach((handler) =>
        handler('sess-9', { type: 'user_message', delta: 'Count to 1500' }),
      );
    });

    await act(async () => {
      result.current.reopen({ id: 'sess-9' });
    });

    await waitFor(() =>
      expect(result.current.requestError?.message).toBe(
        'peer disconnected before response',
      ),
    );
    expect(result.current.isStreaming).toBe(false);
  });

  // The host keeps the outcome of the last turn, and a replay carries no "stopped" of its own.
  it('puts the stopped mark back on the replayed turn the user stopped', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.loadSession.mockImplementation(async () => {
      const fire = (update: AgentUpdate): void =>
        updateHandlers.forEach((handler) => handler('sess-9', update));
      fire({ type: 'user_message', delta: 'Count to 400' });
      fire({ type: 'message_chunk', delta: '1 2 3' });
    });

    await act(async () => {
      result.current.reopen({ id: 'sess-9', status: 'cancelled' });
    });

    await waitFor(() =>
      expect(result.current.messages[1]?.cancelled).toBe(true),
    );
  });

  // The host keeps only that the last turn failed; the reopened chat offers Retry, not only a red dot.
  it('offers Retry on a reopened chat whose last turn failed', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.loadSession.mockImplementation(async () => {
      updateHandlers.forEach((handler) =>
        handler('sess-9', { type: 'user_message', delta: 'Count to 600' }),
      );
    });

    await act(async () => {
      result.current.reopen({ id: 'sess-9', status: 'error' });
    });

    await waitFor(() =>
      expect(result.current.requestError).toMatchObject({ kind: 'replayed' }),
    );
  });

  // The thread names a pick only once it lands; re-selecting the model it shows meanwhile would undo the pick.
  it('does not re-select the old model while a pick is on its way', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() =>
        expect(result.current.currentSessionId).toBe('sess-1'),
      );
      let landed: VoidFunction = () => undefined;
      services.setSessionModel.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            landed = resolve;
          }),
      );

      act(() => {
        void result.current.setModel('fable');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(services.setSessionModel.mock.calls).toEqual([
        ['sess-1', 'fable'],
      ]);

      await act(async () => {
        landed();
      });
      expect(result.current.currentModelId).toBe('fable');
    } finally {
      vi.useRealTimers();
    }
  });

  // Re-selecting the current model makes the engine list its models again: a late-loading one appears with no user action.
  it('refreshes the catalog 3 s and 12 s after the session opens', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.currentModelId).toBe('opus'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(services.setSessionModel.mock.calls).toEqual([['sess-1', 'opus']]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9000);
      });
      expect(services.setSessionModel.mock.calls).toEqual([
        ['sess-1', 'opus'],
        ['sess-1', 'opus'],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-selects the model once the turn that held it back ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let endTurn: VoidFunction = () => undefined;
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() =>
        expect(result.current.currentSessionId).toBe('sess-1'),
      );
      services.prompt.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            endTurn = resolve;
          }),
      );
      act(() => result.current.enqueue('Blink an LED on D13'));
      await waitFor(() =>
        expect(useChatStore.getState().streamingSessions['sess-1']).toBe(true),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(13000);
      });
      expect(services.setSessionModel).not.toHaveBeenCalled();

      endTurn();
      await waitFor(() =>
        expect(useChatStore.getState().streamingSessions).toEqual({}),
      );
      await waitFor(() =>
        expect(services.setSessionModel.mock.calls).toEqual([
          ['sess-1', 'opus'],
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends no model for a user pick of the model the session runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.currentModelId).toBe('opus'));

      await act(async () => {
        await result.current.setModel('opus');
      });
      expect(services.setSessionModel).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.setModel('fable');
      });
      expect(services.setSessionModel.mock.calls).toEqual([
        ['sess-1', 'fable'],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  // The backend starts the next chat on the last switch, so the empty chat must show that model.
  it('shows a switch in a chat as the model of the next one', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentModelId).toBe('opus'));
    act(() =>
      useChatStore
        .getState()
        .setNewSessionPicks({ modelId: 'opus', modeId: 'build' }),
    );

    await act(async () => {
      await result.current.setModel('fable');
    });

    expect(useChatStore.getState().newSessionPicks).toEqual({
      modelId: 'fable',
      modeId: 'build',
    });
  });

  it('says so when the agent refuses a model the user picked', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentModelId).toBe('opus'));
    services.setSessionModel.mockRejectedValueOnce(
      new Error('Invalid params: model not found: fakeprov/alpha'),
    );

    await act(async () => {
      await result.current.setModel('fable');
    });

    expect(result.current.modelPickFailed).toBe(true);
    expect(result.current.currentModelId).toBe('opus');
  });

  // A port such as ":4010" in an engine error is not a 401.
  it('keeps the user signed in for an error that only contains the digits 401', async () => {
    useAiAssistantStore.setState({
      selectedAgentId: 'claude',
      sessionExpired: false,
      auth: { claude: { authenticated: true, agentId: 'claude' } },
    });
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(
      new Error('listen tcp :4010: bind: address already in use'),
    );

    await sendAndSettle(result, 'Start the app');

    expect(result.current.requestError?.message).toContain(':4010');
    expect(useAiAssistantStore.getState().sessionExpired).toBe(false);
    expect(useAiAssistantStore.getState().auth.claude?.authenticated).toBe(
      true,
    );
    useAiAssistantStore.setState({ auth: {} });
  });

  it('sends an agent whose one credential was refused back to sign in', async () => {
    useAiAssistantStore.setState({
      selectedAgentId: 'claude',
      sessionExpired: false,
      auth: { claude: { authenticated: true, agentId: 'claude' } },
    });
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(
      new Error(
        '{"code":-32603,"message":"401 Unauthorized: invalid x-api-key"}',
      ),
    );

    await sendAndSettle(result, 'Blink an LED on D13');

    expect(useAiAssistantStore.getState().sessionExpired).toBe(true);
    expect(useAiAssistantStore.getState().auth.claude?.authenticated).toBe(
      false,
    );
    useAiAssistantStore.setState({ auth: {}, sessionExpired: false });
  });

  it.each([
    ['an empty one', ''],
    ['a JSON-RPC error with no message', '{"code":-32603,"message":""}'],
  ])('shows the failure banner for %s', async (_case, error) => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));
    services.prompt.mockRejectedValueOnce(new Error(error));

    await sendAndSettle(result, 'case empty');

    expect(result.current.requestError).toBeDefined();
  });

  // The docked panel holds the session Agent Mode now shows; unmounting it must not blank the sidebar's pointer.
  it('keeps the shared pointer when a panel that no longer drives the chat unmounts', async () => {
    const main = renderHook(() => useChatLogic());
    await waitFor(() =>
      expect(main.result.current.currentSessionId).toBe('sess-1'),
    );
    const docked = renderHook(
      ({ onScreen }) => useChatLogic(undefined, undefined, onScreen),
      { initialProps: { onScreen: true } },
    );
    await waitFor(() =>
      expect(docked.result.current.currentSessionId).toBe('sess-1'),
    );

    docked.rerender({ onScreen: false });
    docked.unmount();

    expect(useChatStore.getState().currentSessionId).toBe('sess-1');
  });

  it('follows a rename of the session it shows in its header', async () => {
    const { result } = renderHook(() => useChatLogic());
    await waitFor(() => expect(result.current.currentSessionId).toBe('sess-1'));

    act(() =>
      useChatStore.getState().retitleSession('sess-1', 'OC title test'),
    );
    expect(result.current.sessionTitle).toBe('OC title test');

    act(() => useChatStore.getState().retitleSession('sess-2', 'Not this one'));
    expect(result.current.sessionTitle).toBe('OC title test');

    act(() => useChatStore.getState().retitleSession('sess-1', undefined));
    expect(result.current.sessionTitle).toBeUndefined();
  });

  describe('with an engine that stores a session when it is created', () => {
    beforeEach(() => {
      useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    });

    const pendingSession = (): ((id: string) => void) => {
      let open: (id: string) => void = () => undefined;
      services.newSession.mockReturnValue(
        new Promise<string>((resolve) => {
          open = resolve;
        }),
      );
      return (id) => open(id);
    };

    // Every engine restart empties these picks; without them the empty chat shows no pickers at all.
    describe('pickers of the empty chat', () => {
      beforeEach(() => {
        useAiAssistantStore.setState({
          auth: { opencode: { authenticated: true, agentId: 'opencode' } },
          agentDown: undefined,
        });
      });

      afterEach(() => {
        useAiAssistantStore.setState({ auth: {}, agentDown: undefined });
      });

      it('fills them from a new session read without a prompt', async () => {
        const { result } = renderHook(() => useChatLogic());

        await waitFor(() =>
          expect(result.current.models.map((m) => m.id)).toEqual([
            'opus',
            'fable',
          ]),
        );
        expect(result.current.currentModelId).toBe('opus');
        expect(result.current.modes.map((m) => m.id)).toEqual(['build']);
        expect(services.newSessionState).toHaveBeenCalledTimes(1);
        expect(services.newSession).not.toHaveBeenCalled();
        expect(services.prompt).not.toHaveBeenCalled();
      });

      // Agent mode and the docked panel can both be mounted; each read opens a hidden session.
      it('reads once for two mounted chats', async () => {
        const first = renderHook(() => useChatLogic());
        const second = renderHook(() => useChatLogic());

        await waitFor(() => {
          expect(first.result.current.models).toHaveLength(2);
          expect(second.result.current.models).toHaveLength(2);
        });
        expect(services.newSessionState).toHaveBeenCalledTimes(1);
      });

      it('reads them again after the engine restarts', async () => {
        const { result } = renderHook(() => useChatLogic());
        await waitFor(() => expect(result.current.models).toHaveLength(2));

        act(() => useChatStore.getState().resetLoadedSessions());

        await waitFor(() =>
          expect(services.newSessionState).toHaveBeenCalledTimes(2),
        );
        await waitFor(() => expect(result.current.models).toHaveLength(2));
      });

      it('waits while the agent is down', async () => {
        useAiAssistantStore.setState({
          agentDown: { agentId: 'opencode', reason: 'crashed' },
        });
        const { result } = renderHook(() => useChatLogic());
        await waitFor(() => expect(result.current.canCompose).toBe(true));
        expect(services.newSessionState).not.toHaveBeenCalled();

        act(() => useAiAssistantStore.setState({ agentDown: undefined }));

        await waitFor(() => expect(result.current.models).toHaveLength(2));
        expect(services.newSessionState).toHaveBeenCalledTimes(1);
      });

      it('drops an answer from the engine that ran before the restart', async () => {
        let answerOld: (state: SessionState) => void = () => undefined;
        services.newSessionState.mockImplementationOnce(
          () =>
            new Promise<SessionState>((resolve) => {
              answerOld = resolve;
            }),
        );
        const { result } = renderHook(() => useChatLogic());
        await waitFor(() =>
          expect(services.newSessionState).toHaveBeenCalledTimes(1),
        );

        act(() => useChatStore.getState().resetLoadedSessions());
        await waitFor(() => expect(result.current.models).toHaveLength(2));
        await act(async () => {
          answerOld({
            ...sessionState(),
            modelId: 'stale',
            models: [{ id: 'stale', name: 'Old engine' }],
          });
        });

        expect(result.current.models.map((m) => m.id)).toEqual([
          'opus',
          'fable',
        ]);
        expect(useChatStore.getState().newSessionPicks?.modelId).toBe('opus');
      });

      it("keeps the new read when the old engine's read fails after the restart", async () => {
        let failOld: (e: Error) => void = () => undefined;
        let answerNew: (state: SessionState) => void = () => undefined;
        services.newSessionState
          .mockImplementationOnce(
            () =>
              new Promise<SessionState>((_resolve, reject) => {
                failOld = reject;
              }),
          )
          .mockImplementationOnce(
            () =>
              new Promise<SessionState>((resolve) => {
                answerNew = resolve;
              }),
          );
        renderHook(() => useChatLogic());
        await waitFor(() =>
          expect(services.newSessionState).toHaveBeenCalledTimes(1),
        );
        act(() => useChatStore.getState().resetLoadedSessions());
        await waitFor(() =>
          expect(services.newSessionState).toHaveBeenCalledTimes(2),
        );

        await act(async () => {
          failOld(new Error('the engine stopped'));
        });
        const second = renderHook(() => useChatLogic());
        await act(async () => {
          answerNew(sessionState());
        });

        await waitFor(() =>
          expect(second.result.current.models).toHaveLength(2),
        );
        expect(services.newSessionState).toHaveBeenCalledTimes(2);
      });

      it('reads again when the new session listed no models', async () => {
        services.newSessionState.mockResolvedValueOnce({
          ...sessionState(),
          models: [],
        });
        const { result } = renderHook(() => useChatLogic());

        await waitFor(() => expect(result.current.models).toHaveLength(2), {
          timeout: 4000,
        });
        expect(services.newSessionState).toHaveBeenCalledTimes(2);
      });

      it('retries a read the restarting engine refused', async () => {
        services.newSessionState.mockRejectedValueOnce(
          new Error('agent not started'),
        );
        const { result } = renderHook(() => useChatLogic());

        await waitFor(() => expect(result.current.models).toHaveLength(2), {
          timeout: 4000,
        });
        expect(services.newSessionState).toHaveBeenCalledTimes(2);
      });
    });

    it('opens no session on mount: the empty chat takes a prompt', async () => {
      const { result } = renderHook(() => useChatLogic());

      await waitFor(() => expect(result.current.canCompose).toBe(true));
      expect(services.newSession).not.toHaveBeenCalled();
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.isNewSession).toBe(true);
    });

    it('opens the session on the first prompt and fills the toolbar from its state', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      await sendAndSettle(result, 'Blink an LED on D13');

      expect(services.newSession).toHaveBeenCalledTimes(1);
      expect(services.prompt).toHaveBeenCalledWith(
        'sess-1',
        'Blink an LED on D13',
        undefined,
      );
      expect(result.current.currentSessionId).toBe('sess-1');
      expect(result.current.currentModelId).toBe('opus');
      expect(result.current.models.map((m) => m.id)).toEqual(['opus', 'fable']);
      expect(result.current.currentModeId).toBe('build');
    });

    // Enter does not send while the session is created; a second prompt shares the creation and is queued behind the first.
    it('opens one session for two prompts sent before it exists', async () => {
      const openSession = pendingSession();
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      act(() => {
        result.current.enqueue('one');
        result.current.enqueue('two');
      });
      expect(result.current.canCompose).toBe(false);
      await act(async () => {
        openSession('sess-1');
      });
      await waitFor(() =>
        expect(services.prompt).toHaveBeenLastCalledWith(
          'sess-1',
          'two',
          undefined,
        ),
      );

      expect(services.newSession).toHaveBeenCalledTimes(1);
      expect(services.prompt.mock.calls).toEqual([
        ['sess-1', 'one', undefined],
        ['sess-1', 'two', undefined],
      ]);
      expect(result.current.canCompose).toBe(true);
    });

    // Taking the panel back re-runs its opening effect, which must keep the empty chat and its pending session.
    it('adopts the session the first prompt creates even if the panel is taken back meanwhile', async () => {
      const openSession = pendingSession();
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      act(() => {
        result.current.enqueue('Blink an LED on D13');
      });
      // A second panel drives the lifecycle, then unmounts: the first one drives again.
      const other = renderHook(() => useChatLogic());
      await waitFor(() => expect(other.result.current.canCompose).toBe(true));
      other.unmount();
      await act(async () => {
        openSession('sess-1');
      });

      await waitFor(() =>
        expect(result.current.messages.map((m) => m.role)).toEqual([
          'user',
          'assistant',
        ]),
      );
      expect(result.current.currentSessionId).toBe('sess-1');
    });

    // A pick made while the creation applies the earlier one is the one the user wants.
    it('applies a model picked while the first prompt opens its session', async () => {
      let applied: VoidFunction = () => undefined;
      services.setSessionModel.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            applied = resolve;
          }),
      );
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await act(async () => {
        await result.current.setModel('fable');
      });

      act(() => {
        result.current.enqueue('Say hi');
      });
      await waitFor(() =>
        expect(services.setSessionModel).toHaveBeenCalledWith(
          'sess-1',
          'fable',
        ),
      );
      await act(async () => {
        await result.current.setModel('opus');
      });
      await act(async () => {
        applied();
      });
      await waitFor(() => expect(services.prompt).toHaveBeenCalled());

      expect(services.setSessionModel.mock.calls).toEqual([
        ['sess-1', 'fable'],
        ['sess-1', 'opus'],
      ]);
      expect(services.setSessionModel.mock.invocationCallOrder[1]).toBeLessThan(
        services.prompt.mock.invocationCallOrder[0],
      );
      expect(result.current.currentModelId).toBe('opus');
    });

    // One provider refusing its key leaves the agent, its other providers and its free models working.
    it('reports a refused provider key in the chat instead of signing the agent out', async () => {
      useAiAssistantStore.setState({
        sessionExpired: false,
        auth: { opencode: { authenticated: true, agentId: 'opencode' } },
      });
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      services.prompt.mockRejectedValueOnce(
        new Error(
          '{"code":-32603,"message":"401 Unauthorized: invalid x-api-key"}',
        ),
      );

      await sendAndSettle(result, 'case 401');

      expect(result.current.requestError).toMatchObject({
        kind: 'auth',
        message: '401 Unauthorized: invalid x-api-key',
      });
      expect(useAiAssistantStore.getState().sessionExpired).toBe(false);
      expect(useAiAssistantStore.getState().auth.opencode?.authenticated).toBe(
        true,
      );
      useAiAssistantStore.setState({ auth: {} });
    });

    it('sends no model picked before the first prompt that the new session already runs', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await act(async () => {
        await result.current.setModel('opus');
      });

      await sendAndSettle(result, 'Blink an LED on D13');

      expect(services.setSessionModel).not.toHaveBeenCalled();
      expect(result.current.currentModelId).toBe('opus');
    });

    it('applies a model picked before the first prompt, before that prompt', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      await act(async () => {
        await result.current.setModel('fable');
      });
      expect(services.setSessionModel).not.toHaveBeenCalled();
      expect(result.current.currentModelId).toBe('fable');

      await sendAndSettle(result, 'Blink an LED on D13');

      expect(services.setSessionModel).toHaveBeenCalledWith('sess-1', 'fable');
      expect(services.setSessionModel.mock.invocationCallOrder[0]).toBeLessThan(
        services.prompt.mock.invocationCallOrder[0],
      );
      expect(result.current.currentModelId).toBe('fable');
    });

    // The backend starts the next chat on the switch the picks made, so the empty chat shows that model, not the reported one.
    it('shows in an empty chat the model picked before the last first prompt', async () => {
      services.getSessionState.mockResolvedValue({
        ...sessionState(),
        modelId: 'fable',
      });
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await act(async () => {
        await result.current.setModel('opus');
      });
      await sendAndSettle(result, 'Blink an LED on D13');

      act(() => {
        result.current.newChat();
      });
      await waitFor(() => expect(result.current.currentSessionId).toBeNull());

      expect(result.current.currentModelId).toBe('opus');
      expect(result.current.models.map((m) => m.id)).toEqual(['opus', 'fable']);
    });

    it('leaves the session in the background if the panel moves on while the picks are applied', async () => {
      let applied: VoidFunction = () => undefined;
      services.setSessionModel.mockReturnValue(
        new Promise<void>((resolve) => {
          applied = resolve;
        }),
      );
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await act(async () => {
        await result.current.setModel('fable');
      });

      act(() => {
        result.current.enqueue('Blink an LED on D13');
      });
      await waitFor(() => expect(services.setSessionModel).toHaveBeenCalled());
      act(() => {
        result.current.newChat();
      });
      await act(async () => {
        applied();
      });
      await waitFor(() =>
        expect(services.prompt).toHaveBeenCalledWith(
          'sess-1',
          'Blink an LED on D13',
          undefined,
        ),
      );

      expect(result.current.currentSessionId).toBeNull();
      expect(
        useChatStore.getState().threads['sess-1']?.messages.map((m) => m.role),
      ).toEqual(['user', 'assistant']);
    });

    // The composer has already cleared the prompt, so a session that does not open has to say why.
    it('shows why the session for the first prompt did not open', async () => {
      services.newSession.mockRejectedValue(new Error('the engine is down'));
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      act(() => {
        result.current.enqueue('Blink an LED on D13');
      });
      await waitFor(() =>
        expect(result.current.restoredDraft).toEqual({
          text: 'Blink an LED on D13',
        }),
      );

      expect(services.prompt).not.toHaveBeenCalled();
      expect(result.current.bootstrapError).toContain('the engine is down');
      expect(result.current.canCompose).toBe(true);
    });

    it('names the chat with the title the engine gives after the first prompt', async () => {
      services.listSessions.mockResolvedValue([
        { id: 'sess-1', title: 'Blink an LED on D13' },
      ]);
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      await sendAndSettle(result, 'Blink an LED on D13');

      await waitFor(() =>
        expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
      );
    });

    it('opens no session when a reset empties the chat', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await sendAndSettle(result, 'Blink an LED on D13');
      expect(result.current.currentSessionId).toBe('sess-1');

      await act(async () => {
        useChatStore.getState().reset();
      });
      await waitFor(() => expect(result.current.currentSessionId).toBeNull());

      expect(services.newSession).toHaveBeenCalledTimes(1);
      expect(result.current.canCompose).toBe(true);
    });

    // An empty chat has no session to carry its workspace across a remount.
    it("keeps an empty chat's workspace across a remount", async () => {
      const first = renderHook(() => useChatLogic());
      await waitFor(() => expect(first.result.current.canCompose).toBe(true));
      act(() => {
        first.result.current.selectWorkspace('app-1', 'Blink');
      });
      await waitFor(() =>
        expect(first.result.current.workspaceId).toBe('app-1'),
      );
      first.unmount();

      const second = renderHook(() => useChatLogic());
      await waitFor(() => expect(second.result.current.canCompose).toBe(true));

      expect(second.result.current.workspaceId).toBe('app-1');
      expect(services.newSession).not.toHaveBeenCalled();
    });

    // Before a first prompt has shown what a new session starts with, any pick shown would be a guess.
    it('offers no pickers in an empty chat before a new session has shown what it starts with', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      act(() => {
        result.current.reopen({ id: 'sess-old' });
      });
      await waitFor(() => expect(result.current.currentModelId).toBe('opus'));

      act(() => {
        result.current.newChat();
      });
      await waitFor(() => expect(result.current.currentSessionId).toBeNull());

      expect(result.current.models).toEqual([]);
      expect(result.current.modes).toEqual([]);
      expect(result.current.currentModelId).toBeUndefined();
    });

    // A restart can change what a new session starts with: keys added or removed change the models.
    it('forgets what a new session starts with when the engine restarts', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await sendAndSettle(result, 'Blink an LED on D13');
      act(() => {
        result.current.newChat();
      });
      await waitFor(() => expect(result.current.currentModelId).toBe('opus'));

      act(() => {
        useChatStore.getState().resetLoadedSessions();
      });

      await waitFor(() => expect(result.current.models).toEqual([]));
      expect(result.current.currentSessionId).toBeNull();
    });

    it('clears the failure once a later first prompt opens its session', async () => {
      services.newSession.mockRejectedValueOnce(
        new Error('the engine is down'),
      );
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      act(() => {
        result.current.enqueue('Blink an LED on D13');
      });
      await waitFor(() =>
        expect(result.current.bootstrapError).toContain('the engine is down'),
      );

      await sendAndSettle(result, 'Blink an LED on D13');

      expect(result.current.bootstrapError).toBeUndefined();
      expect(result.current.currentSessionId).toBe('sess-1');
    });

    // A creation that never returns must not lock every later empty chat of the panel.
    it('takes a prompt again after New session while a creation hangs', async () => {
      services.newSession.mockReturnValueOnce(
        new Promise<string>(() => undefined),
      );
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      act(() => {
        result.current.enqueue('one');
      });
      expect(result.current.canCompose).toBe(false);

      act(() => {
        result.current.newChat();
      });
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      await sendAndSettle(result, 'two');

      expect(services.newSession).toHaveBeenCalledTimes(2);
      expect(result.current.currentSessionId).toBe('sess-1');
      expect(services.prompt).toHaveBeenCalledWith('sess-1', 'two', undefined);
    });

    // OpenCode names a session only after its turn has ended; the header must still pick the name up.
    it('picks up a title the engine gives after the turn has ended', async () => {
      services.listSessions.mockResolvedValue([
        { id: 'sess-1', title: 'New session - 2026-09-16T10:11:07.172Z' },
      ]);
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await sendAndSettle(result, 'Blink an LED on D13');
        expect(result.current.sessionTitle).toBeUndefined();
        const version = useChatStore.getState().sessionListVersion;

        services.listSessions.mockResolvedValue([
          { id: 'sess-1', title: 'Blink an LED on D13' },
        ]);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        await waitFor(() =>
          expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
        );
        expect(useChatStore.getState().sessionListVersion).toBe(version + 1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps asking a session that went to the background for its late title', async () => {
      services.listSessions.mockResolvedValue([
        { id: 'sess-1', title: 'New session - 2026-09-16T10:11:07.172Z' },
      ]);
      let finishTurn: VoidFunction = () => undefined;
      services.prompt.mockReturnValue(
        new Promise<void>((resolve) => {
          finishTurn = resolve;
        }),
      );
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        act(() => {
          result.current.enqueue('Blink an LED on D13');
        });
        await waitFor(() => expect(services.prompt).toHaveBeenCalled());
        act(() => {
          result.current.newChat();
        });
        await act(async () => {
          finishTurn();
        });
        await waitFor(() =>
          expect(useChatStore.getState().streamingSessions).toEqual({}),
        );
        const version = useChatStore.getState().sessionListVersion;

        services.listSessions.mockResolvedValue([
          { id: 'sess-1', title: 'Blink an LED on D13' },
        ]);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        await waitFor(() =>
          expect(useChatStore.getState().sessionListVersion).toBe(version + 1),
        );
        expect(result.current.sessionTitle).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    // Reopening through a remount or a workspace switch reads the title from what remembered the session.
    it('remembers the title where the session is remembered', async () => {
      services.listSessions.mockResolvedValue([
        { id: 'sess-1', title: 'Blink an LED on D13' },
      ]);
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));

      await sendAndSettle(result, 'Blink an LED on D13');
      await waitFor(() =>
        expect(result.current.sessionTitle).toBe('Blink an LED on D13'),
      );

      expect(useChatStore.getState().lastSessionTitle).toBe(
        'Blink an LED on D13',
      );
      expect(useChatStore.getState().lastSessionByWorkspace['']?.title).toBe(
        'Blink an LED on D13',
      );
    });

    it('opens an empty chat when coming back to a workspace left on one', async () => {
      const { result } = renderHook(() => useChatLogic());
      await waitFor(() => expect(result.current.canCompose).toBe(true));
      act(() => {
        result.current.reopen({
          id: 'sess-9',
          workspaceAppId: 'app-1',
          workspaceName: 'Blink',
        });
      });
      await waitFor(() =>
        expect(result.current.currentSessionId).toBe('sess-9'),
      );

      act(() => {
        result.current.newChat();
      });
      await waitFor(() => expect(result.current.currentSessionId).toBeNull());
      act(() => {
        result.current.selectWorkspace('');
      });
      await waitFor(() => expect(result.current.workspaceId).toBe(''));
      act(() => {
        result.current.selectWorkspace('app-1', 'Blink');
      });
      await waitFor(() => expect(result.current.workspaceId).toBe('app-1'));

      expect(result.current.currentSessionId).toBeNull();
      expect(services.loadSession).toHaveBeenCalledTimes(1);
    });
  });
});

describe('permissionView — plan approval', () => {
  it('hides the auto and bypass options claude-agent-acp sends', () => {
    const request: PermissionRequest = {
      id: 'p1',
      sessionId: 's1',
      toolCall: {
        id: 't1',
        title: 'Approve Plan',
        kind: 'switch_mode',
        status: 'pending',
      },
      options: [
        {
          id: 'exit-plan-default',
          label: 'Yes, manually approve edits',
          kind: 'allow_once',
        },
        {
          id: 'exit-plan-clear-auto',
          label: 'Yes, clear context and use auto mode',
          kind: 'allow_always',
        },
        {
          id: 'exit-plan-auto',
          label: 'Yes, and use auto mode',
          kind: 'allow_always',
        },
        {
          id: 'exit-plan-clear-bypass',
          label: 'Yes, clear context and bypass permissions',
          kind: 'allow_always',
        },
        {
          id: 'exit-plan-bypass',
          label: 'Yes, and bypass permissions',
          kind: 'allow_always',
        },
        { id: 'reject', label: 'No, keep planning', kind: 'reject_once' },
      ],
    };

    expect(permissionView(request).actions.map((a) => a.id)).toEqual([
      'exit-plan-default',
      'reject',
    ]);
  });
});
