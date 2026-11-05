import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentRestart, AgentUpdate, PermissionRequest } from '../services';
import { useAiAssistantStore } from './aiAssistantStore';
import type { ChatMessage } from './chatStore';
import {
  chatDriver,
  estimateOutputTokens,
  lastTurnFailed,
  readOpenSession,
  subscribeAgentStream,
  subscribeSessionReads,
  subscribeWorkspaceAppForgotten,
  subscribeWorkspaceAppRenamed,
  useChatStore,
} from './chatStore';

// The store's runtime dependencies on the services layer. The fakes keep the registered handlers so a
// test can fire what Go emits: an app deleted (from the UI or by the agent's own apps_delete), and the
// agent stream the store subscribes to for the whole app session.
const forgottenHandlers = vi.hoisted((): ((appId: string) => void)[] => []);
const renamedHandlers = vi.hoisted(
  (): ((oldId: string, newId: string, newName: string) => void)[] => [],
);
const updateHandlers = vi.hoisted(
  (): ((sessionId: string, update: AgentUpdate) => void)[] => [],
);
const permissionHandlers = vi.hoisted(
  (): ((request: PermissionRequest) => void)[] => [],
);
const restartHandlers = vi.hoisted(
  (): ((restart: AgentRestart) => void)[] => [],
);
const markSessionRead = vi.hoisted(() =>
  vi.fn((): Promise<boolean> => Promise.resolve(false)),
);
vi.mock('../services', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAgent: (id?: string): { perProviderKeys: boolean } | undefined =>
    id === 'opencode' ? { perProviderKeys: true } : undefined,
  markSessionRead,
  onWorkspaceAppForgotten: (handler: (appId: string) => void): VoidFunction => {
    forgottenHandlers.push(handler);
    return vi.fn();
  },
  onWorkspaceAppRenamed: (
    handler: (oldId: string, newId: string, newName: string) => void,
  ): VoidFunction => {
    renamedHandlers.push(handler);
    return vi.fn();
  },
  onUpdate: (
    handler: (sessionId: string, update: AgentUpdate) => void,
  ): VoidFunction => {
    updateHandlers.push(handler);
    return () => updateHandlers.splice(updateHandlers.indexOf(handler), 1);
  },
  onPermission: (
    handler: (request: PermissionRequest) => void,
  ): VoidFunction => {
    permissionHandlers.push(handler);
    return () =>
      permissionHandlers.splice(permissionHandlers.indexOf(handler), 1);
  },
  onRestart: (handler: (restart: AgentRestart) => void): VoidFunction => {
    restartHandlers.push(handler);
    return () => restartHandlers.splice(restartHandlers.indexOf(handler), 1);
  },
}));

// resetLoadedSessions is what makes a crashed-out agent recoverable. bootstrap only replays a session
// (loadSession) when it has no thread in memory, so a thread that outlives the agent process makes it
// skip the replay and go on prompting a session id the replacement process has never loaded.
describe('useChatStore.resetLoadedSessions', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  const openSession = (id: string, title: string): void => {
    const store = useChatStore.getState();
    store.setLastSession(id, title);
    store.setCurrentSessionId(id);
    store.addMessage(id, { id: 'm1', role: 'user', parts: [] });
    store.beginTurn(id); // a turn in flight, like a session left streaming
  };

  it('drops the in-memory threads but keeps the session to reopen', () => {
    openSession('sess-blink', 'Blink an LED on D13');

    useChatStore.getState().resetLoadedSessions();

    const state = useChatStore.getState();
    expect(state.threads).toEqual({}); // so bootstrap replays instead of trusting a dead thread
    expect(state.streamingSessions).toEqual({}); // a dead agent has no turn in flight
    expect(state.lastSessionId).toBe('sess-blink'); // the reconnect lands back in the same chat
    expect(state.lastSessionTitle).toBe('Blink an LED on D13');
  });

  // An unprompted draft only exists in the crashed process's memory — the agent never persisted it, so
  // replaying it would fail. Forgetting it sends the reconnect to a fresh chat instead of a dead end.
  // The replay after the restart carries no failure: the reopen needs to know the last turn failed.
  it('keeps how the last turn of the session to reopen ended', () => {
    const store = useChatStore.getState();
    store.setLastSession('sess-blink', 'Blink an LED on D13');
    store.addUserText('sess-blink', 'Blink an LED on D13');
    const reply = store.beginTurn('sess-blink');
    store.setMessageError('sess-blink', reply, 'peer disconnected');
    store.endTurn('sess-blink');

    store.resetLoadedSessions();

    expect(useChatStore.getState().lastSessionStatus).toBe('error');
  });

  it('forgets the session to reopen when it was an unprompted draft', () => {
    openSession('sess-draft', 'New chat');
    useChatStore.getState().setDraftSessionId('sess-draft');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionId).toBeNull();
    expect(useChatStore.getState().lastSessionTitle).toBeUndefined();
  });

  // The turn the teardown killed settles later (its Go epilogue syncs mirrors over the board being
  // swapped), so send()'s finally runs against the wiped store. Anything it recreated there would read
  // as a loaded thread and cost the reopened session its replay — the board switch would empty it.
  it('is not undone by the killed turn settling afterwards', () => {
    openSession('sess-blink', 'Blink an LED on D13');

    useChatStore.getState().resetLoadedSessions();
    const store = useChatStore.getState();
    store.setMessageError('sess-blink', 'm1', 'the agent stopped');
    store.endTurn('sess-blink');

    expect(useChatStore.getState().threads).toEqual({});
  });

  it('leaves the first message of a session free to start its thread', () => {
    openSession('sess-blink', 'Blink an LED on D13');
    useChatStore.getState().resetLoadedSessions();

    useChatStore
      .getState()
      .addMessage('sess-blink', { id: 'm1', role: 'user', parts: [] });

    expect(
      useChatStore.getState().threads['sess-blink']?.messages,
    ).toHaveLength(1);
  });

  it('keeps the session to reopen when the draft is a different one', () => {
    openSession('sess-blink', 'Blink an LED on D13');
    useChatStore.getState().setDraftSessionId('sess-other');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionId).toBe('sess-blink');
    expect(useChatStore.getState().draftSessionId).toBeNull();
  });
});

// Two panels can be mounted at once, and only one may drive the session lifecycle: the workspace
// rebind, bootstrap/resume, and consuming a sessionRequest. The stream is not theirs.
describe('chatStore — chat ownership', () => {
  const driver = (): string | undefined =>
    chatDriver(useChatStore.getState().chatOwners);

  beforeEach(() => {
    useChatStore.getState().chatOwners.forEach(({ id }) => {
      useChatStore.getState().releaseChat(id);
    });
  });

  it('gives it to the panel on screen, not the one that mounted last', () => {
    useChatStore.getState().claimChat('full-screen', true);
    useChatStore.getState().claimChat('editor', false);

    expect(driver()).toBe('full-screen');
  });

  // Clearing agentDown remounts the full-screen panel; hidden, it must not take over from the docked one.
  it('keeps it with the docked panel when the hidden one re-claims', () => {
    useChatStore.getState().claimChat('editor', true);
    useChatStore.getState().claimChat('full-screen', false);

    expect(driver()).toBe('editor');
  });

  // Editor mode with the side panel closed: nobody is on screen, but one panel still has to hold the lifecycle.
  it('falls back to the last mounted panel when none is on screen', () => {
    useChatStore.getState().claimChat('full-screen', false);

    expect(driver()).toBe('full-screen');
  });

  it('hands it back when the driving panel goes', () => {
    useChatStore.getState().claimChat('full-screen', false);
    useChatStore.getState().claimChat('editor', true);
    expect(driver()).toBe('editor');

    useChatStore.getState().releaseChat('editor');
    expect(driver()).toBe('full-screen');
  });

  it('never leaves two owners for one panel', () => {
    useChatStore.getState().claimChat('full-screen', false);
    useChatStore.getState().claimChat('full-screen', true);

    expect(useChatStore.getState().chatOwners).toEqual([
      { id: 'full-screen', onScreen: true },
    ]);
  });

  // reset() clears session data on sign-out or a board switch, while the panels stay mounted.
  it('survives a reset', () => {
    useChatStore.getState().claimChat('full-screen', true);
    useChatStore.getState().reset();

    expect(driver()).toBe('full-screen');
  });
});

// Switching workspace must land on the chat that workspace was left on, not on whatever was open last anywhere else.
describe('chatStore — last session per workspace', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('remembers one session per workspace', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-blink', 'Blink chat', { id: 'app-blink' });
    store.setLastSession('s-general', 'General chat', { id: '' });

    const { lastSessionByWorkspace } = useChatStore.getState();
    expect(lastSessionByWorkspace['app-blink']).toEqual({
      id: 's-blink',
      title: 'Blink chat',
    });
    expect(lastSessionByWorkspace['']).toEqual({
      id: 's-general',
      title: 'General chat',
    });
  });

  it('forgets one workspace without touching the others', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-blink', undefined, { id: 'app-blink' });
    store.setLastSession('s-other', undefined, { id: 'app-other' });

    useChatStore.getState().forgetWorkspaceSession('app-blink');

    const { lastSessionByWorkspace } = useChatStore.getState();
    expect(lastSessionByWorkspace['app-blink']).toBeUndefined();
    expect(lastSessionByWorkspace['app-other']?.id).toBe('s-other');
  });

  // The sidebar deletes by session, from any workspace: keying the cleanup on the open one would leave the deleted id behind.
  it('forgets a deleted session in whichever workspace remembered it', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-blink', undefined, { id: 'app-blink' });
    store.setLastSession('s-other', undefined, { id: 'app-other' });

    useChatStore.getState().forgetSession('s-blink');

    const { lastSessionByWorkspace } = useChatStore.getState();
    expect(lastSessionByWorkspace['app-blink']).toBeUndefined();
    expect(lastSessionByWorkspace['app-other']?.id).toBe('s-other');
  });

  // A restart is allowed to forget where each workspace was; a sign-out mid-run is not different.
  it('is cleared by reset', () => {
    useChatStore
      .getState()
      .setLastSession('s-blink', undefined, { id: 'app-blink' });
    useChatStore.getState().reset();

    expect(useChatStore.getState().lastSessionByWorkspace).toEqual({});
  });

  // The agent process is replaced on restart: the surviving session keeps its place here too, or its workspace opens an empty chat.
  it('keeps the surviving session in the per-workspace map across a reset', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-blink', 'Blink chat', { id: 'app-blink' });

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionByWorkspace['app-blink']).toEqual(
      {
        id: 's-blink',
        title: 'Blink chat',
      },
    );
  });

  // A title the user gives in the sidebar is what reopening the session shows, and what its header shows now.
  it('carries a rename to what remembers the session and to the panel showing it', () => {
    const store = useChatStore.getState();
    store.setLastSession('s1', 'Engine title', { id: 'app-1' });

    store.retitleSession('s1', 'My own name');

    const state = useChatStore.getState();
    expect(state.lastSessionTitle).toBe('My own name');
    expect(state.lastSessionByWorkspace['app-1']?.title).toBe('My own name');
    expect(state.retitled).toMatchObject({
      sessionId: 's1',
      title: 'My own name',
    });
  });

  it('drops an unused draft from the map on a reset', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-draft', undefined, { id: 'app-blink' });
    store.setDraftSessionId('s-draft');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionByWorkspace).toEqual({});
  });
});

// One subscriber for the whole app. Two ChatPanels can be mounted at once (the editor's docked panel
// and full-screen Agent Mode), and each subscribing from its own hook made both receive every update,
// so one had to be gated out at event time. The store subscribes; the panels only read.
describe('chatStore — the agent stream', () => {
  const fire = (sessionId: string, update: AgentUpdate): void =>
    updateHandlers.forEach((handler) => handler(sessionId, update));
  const askPermission = (request: PermissionRequest): void =>
    permissionHandlers.forEach((handler) => handler(request));
  // What an opened session has, and how bootstrap starts it.
  const openThread = (sessionId: string): void =>
    useChatStore.getState().resetThread(sessionId);
  const messagesOf = (sessionId: string): ChatMessage[] =>
    useChatStore.getState().threads[sessionId]?.messages ?? [];

  let unsubscribe: VoidFunction | undefined;

  beforeEach(() => {
    useChatStore.getState().reset();
    useChatStore.getState().chatOwners.forEach(({ id }) => {
      useChatStore.getState().releaseChat(id);
    });
    unsubscribe?.(); // the subscription is process-wide, so each test starts its own
    updateHandlers.length = 0;
    permissionHandlers.length = 0;
    restartHandlers.length = 0;
    unsubscribe = subscribeAgentStream();
  });

  it('writes an update once with both panels mounted', () => {
    useChatStore.getState().claimChat('editor', false);
    useChatStore.getState().claimChat('full-screen', true);
    openThread('sess-blink');

    fire('sess-blink', { type: 'message_chunk', delta: 'Blinking D13' });

    const messages = messagesOf('sess-blink');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.parts).toEqual([
      { type: 'text', id: `${messages[0]?.id}-t0`, text: 'Blinking D13' },
    ]);
  });

  // injectDependencies() starts it from a module body, so an HMR reload of that module in dev reaches
  // it again; a second subscriber would double every update, which is the bug this replaced. The
  // second caller releasing must not cut the first one off either.
  it('subscribes once however often it is started', () => {
    const release = subscribeAgentStream();
    openThread('sess-blink');
    expect(updateHandlers).toHaveLength(1);

    release();
    fire('sess-blink', { type: 'message_chunk', delta: 'Blinking' });

    const messages = messagesOf('sess-blink');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.parts).toEqual([
      { type: 'text', id: `${messages[0]?.id}-t0`, text: 'Blinking' },
    ]);
  });

  it('keeps one turn in a single assistant message', () => {
    openThread('sess-blink');

    fire('sess-blink', { type: 'message_chunk', delta: 'Blink' });
    fire('sess-blink', { type: 'message_chunk', delta: 'ing' });

    const messages = messagesOf('sess-blink');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.parts).toEqual([
      { type: 'text', id: `${messages[0]?.id}-t0`, text: 'Blinking' },
    ]);
  });

  // Nobody opened this session, so it has no thread and this must not start one: a thread created here
  // would outlive resetLoadedSessions and cost the reopened session its history replay.
  it('drops an update for a session nobody opened', () => {
    fire('sess-never-opened', { type: 'message_chunk', delta: 'Blinking' });

    expect(useChatStore.getState().threads).toEqual({});
  });

  // The other half of that rule: a turn left running when the panel closed keeps building, because the
  // session was opened and its thread is still there.
  it('keeps writing a turn of an open session with no panel mounted', () => {
    openThread('sess-blink');

    fire('sess-blink', { type: 'message_chunk', delta: 'still going' });

    expect(useChatStore.getState().chatOwners).toEqual([]);
    expect(messagesOf('sess-blink')).toHaveLength(1);
  });

  // loadSession replays a persisted session's history through the same subscriber.
  it('replays a history user turn as a user message', () => {
    openThread('sess-blink');

    fire('sess-blink', { type: 'user_message', delta: 'Blink an LED on D13' });

    const [message] = messagesOf('sess-blink');
    expect(message?.role).toBe('user');
    expect(message?.parts).toEqual([
      { type: 'text', id: `${message?.id}-t0`, text: 'Blink an LED on D13' },
    ]);
  });

  // The toolbar reads the session it displays: signals go to their own session's thread, so switching
  // panel mid-turn shows the right model, mode and token count instead of the other session's.
  it('puts the toolbar signals on the session they belong to', () => {
    openThread('sess-a');
    openThread('sess-b');

    fire('sess-a', {
      type: 'model_change',
      modelId: 'opus',
      models: [{ id: 'opus', name: 'Opus 5' }],
    });
    fire('sess-a', { type: 'mode_change', modeId: 'plan' });
    fire('sess-b', { type: 'message_chunk', delta: 'four' });

    const { threads } = useChatStore.getState();
    expect(threads['sess-a']?.pickers).toEqual({
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [],
      currentModeId: 'plan',
    });
    expect(threads['sess-a']?.turnOutChars).toBeUndefined();
    expect(threads['sess-b']?.pickers).toBeUndefined();
    expect(threads['sess-b']?.turnOutChars).toBe(4);
  });

  // After a load the host sends the session's whole mode list with the mode, so the Mode picker comes back.
  it('takes the mode list a mode change carries', () => {
    openThread('sess-a');
    useChatStore.getState().setSessionPickers('sess-a', {
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [],
    });

    fire('sess-a', {
      type: 'mode_change',
      modeId: 'plan',
      modes: [
        { id: 'default', name: 'Default' },
        { id: 'plan', name: 'Plan' },
      ],
    });
    fire('sess-a', { type: 'mode_change', modeId: 'default' });

    expect(useChatStore.getState().threads['sess-a']?.pickers).toEqual({
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [
        { id: 'default', name: 'Default' },
        { id: 'plan', name: 'Plan' },
      ],
      currentModeId: 'default',
    });
  });

  // The engines' figure is the whole context, file reads included; the counter shows what was written.
  it('ignores the usage figure the engine reports', () => {
    openThread('sess-blink');
    useChatStore.getState().beginTurn('sess-blink');

    fire('sess-blink', {
      type: 'usage',
      usedTokens: 12000,
      contextSize: 200000,
    });

    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(0);
  });

  // A cold/transient re-advertise arrives with fewer models; dropping one would take an already-shown
  // model out of the picker under the user.
  it('never drops an advertised model on a re-advertise', () => {
    openThread('sess-blink');

    fire('sess-blink', {
      type: 'model_change',
      models: [
        { id: 'opus', name: 'Opus 5' },
        { id: 'fable', name: 'Fable 5' },
      ],
    });
    fire('sess-blink', {
      type: 'model_change',
      models: [{ id: 'opus', name: 'Opus 5' }],
    });

    expect(
      useChatStore.getState().threads['sess-blink']?.pickers?.models,
    ).toEqual([
      { id: 'opus', name: 'Opus 5' },
      { id: 'fable', name: 'Fable 5' },
    ]);
  });

  // getSessionState can come back with a cold catalog after a model_change has already advertised a
  // warmer one; the hydrate is a writer of the same list, so it grows it too. Nothing else repairs
  // this: the 3s/12s re-advertise only fires for a model the session itself reported.
  it('keeps an advertised model when the session state is hydrated', () => {
    openThread('sess-blink');
    fire('sess-blink', {
      type: 'model_change',
      models: [
        { id: 'opus', name: 'Opus 5' },
        { id: 'fable', name: 'Fable 5' },
      ],
    });

    useChatStore.getState().setSessionPickers('sess-blink', {
      models: [{ id: 'opus', name: 'Opus 5' }], // the cold read
      currentModelId: 'opus',
      modes: [{ id: 'build', name: 'Build' }],
      currentModeId: 'build',
    });

    const { pickers } = useChatStore.getState().threads['sess-blink'] ?? {};
    expect(pickers?.models.map((m) => m.id)).toEqual(['opus', 'fable']);
    expect(pickers?.modes.map((m) => m.id)).toEqual(['build']);
    expect(pickers?.currentModelId).toBe('opus');
  });

  // After a load or a resume the host names the mode alone: the list read from the session state stays.
  it('keeps the listed modes when a mode change names only the mode', () => {
    openThread('sess-blink');
    useChatStore.getState().setSessionPickers('sess-blink', {
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [
        { id: 'build', name: 'Build' },
        { id: 'plan', name: 'Plan' },
      ],
      currentModeId: 'build',
    });

    fire('sess-blink', { type: 'mode_change', modeId: 'plan' });

    const { pickers } = useChatStore.getState().threads['sess-blink'] ?? {};
    expect(pickers?.modes.map((m) => m.id)).toEqual(['build', 'plan']);
    expect(pickers?.currentModeId).toBe('plan');
  });

  it('puts a permission request on its own session', () => {
    openThread('sess-a');
    openThread('sess-b');

    askPermission({ id: 'perm-1', sessionId: 'sess-b', options: [] });

    const { threads } = useChatStore.getState();
    expect(threads['sess-a']?.pendingPermission).toBeUndefined();
    expect(threads['sess-b']?.pendingPermission?.id).toBe('perm-1');
  });

  // The host replays a live session from its own log, and a live update can land before that replay.
  it('rebuilds a replayed session from the start, keeping its toolbar and its card', () => {
    openThread('sess-count');
    fire('sess-count', { type: 'message_chunk', delta: ' 808 809' });
    useChatStore.getState().setSessionPickers('sess-count', {
      models: [{ id: 'opus', name: 'Opus 5' }],
      currentModelId: 'opus',
      modes: [],
    });
    askPermission({ id: 'perm-1', sessionId: 'sess-count', options: [] });

    fire('sess-count', { type: 'replay_start' });
    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });

    const thread = useChatStore.getState().threads['sess-count'];
    expect(thread?.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(thread?.messages[1]?.parts).toEqual([
      { type: 'text', id: expect.any(String), text: '1 2 3' },
    ]);
    expect(thread?.pickers?.currentModelId).toBe('opus');
    expect(thread?.pendingPermission?.id).toBe('perm-1');
  });

  // The host logs the error as the engine returned it: a JSON-RPC payload whose cause is in its data.
  it('shows the failure a replayed turn ended with', () => {
    openThread('sess-count');

    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });
    fire('sess-count', {
      type: 'message_error',
      message:
        '{"code":-32603,"message":"Internal error","data":{"error":"peer disconnected before response"}}',
    });

    const [, reply] = messagesOf('sess-count');
    expect(reply?.status).toBe('error');
    expect(reply?.error).toBe('peer disconnected before response');
  });

  // Every stopped turn of a replay gets its mark, not only the last one; one stopped before any reply gets an empty reply.
  it('marks each turn a replay says the user stopped', () => {
    openThread('sess-count');

    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });
    fire('sess-count', { type: 'turn_stopped' });
    fire('sess-count', { type: 'user_message', delta: 'Blink an LED' });
    fire('sess-count', { type: 'turn_stopped' });
    fire('sess-count', { type: 'user_message', delta: 'Count to 3' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });

    const messages = messagesOf('sess-count');
    expect(messages.map((m) => [m.role, !!m.cancelled])).toEqual([
      ['user', false],
      ['assistant', true],
      ['user', false],
      ['assistant', true],
      ['user', false],
      ['assistant', false],
    ]);
    expect(messages[1]?.parts).toEqual([
      { type: 'text', id: expect.any(String), text: '1 2 3' },
    ]);
    expect(messages[3]?.parts).toEqual([]);
  });

  it('glues nothing the replay sends after the mark to the stopped reply', () => {
    openThread('sess-count');

    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });
    fire('sess-count', { type: 'turn_stopped' });
    fire('sess-count', {
      type: 'message_chunk',
      delta: 'No response requested.',
    });

    const messages = messagesOf('sess-count');
    expect(messages.map((m) => [m.role, !!m.cancelled])).toEqual([
      ['user', false],
      ['assistant', true],
      ['assistant', false],
    ]);
  });

  // An update with no status maps to pending; arriving after the end, it must not reopen the call or drop its output.
  it('keeps a call that ended as it ended', () => {
    openThread('sess-blink');
    fire('sess-blink', {
      type: 'tool_call',
      toolCall: {
        id: 'call-1',
        title: 'Rename',
        kind: 'move',
        status: 'pending',
      },
    });
    fire('sess-blink', {
      type: 'tool_call_update',
      id: 'call-1',
      status: 'completed',
      output: 'renamed',
    });
    fire('sess-blink', {
      type: 'tool_call_update',
      id: 'call-1',
      status: 'pending',
    });
    fire('sess-blink', {
      type: 'tool_call_update',
      id: 'call-1',
      status: 'in_progress',
    });

    const [part] = messagesOf('sess-blink')[0]?.parts ?? [];
    expect(part?.type === 'tool_call' && part.toolCall).toMatchObject({
      status: 'completed',
      output: 'renamed',
    });
  });

  // The prompt's rejection reported it already; the host's copy after the turn's end must not add a reply.
  it('keeps one failed reply when the host reports a failure the prompt already gave', () => {
    openThread('sess-count');
    const store = useChatStore.getState();
    store.addUserText('sess-count', 'Count to 1500');
    const reply = store.beginTurn('sess-count');
    store.setMessageError('sess-count', reply, 'parsed cause', 'auth');
    store.endTurn('sess-count');

    fire('sess-count', { type: 'message_error', message: 'raw cause' });

    const messages = messagesOf('sess-count');
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      error: 'parsed cause',
      errorKind: 'auth',
    });
  });

  // After a reload the turn is still running on the host: it streams on into the reply the replay rebuilt.
  it('follows a turn sent before a reload in the reply the replay rebuilt', () => {
    openThread('sess-count');
    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });
    fire('sess-count', { type: 'message_chunk', delta: '1 2 3' });
    const [, replayed] = messagesOf('sess-count');

    const id = useChatStore.getState().resumeTurn('sess-count');
    fire('sess-count', { type: 'message_chunk', delta: ' 4' });

    expect(id).toBe(replayed?.id);
    expect(useChatStore.getState().streamingSessions['sess-count']).toBe(true);
    const messages = messagesOf('sess-count');
    expect(messages).toHaveLength(2);
    expect(messages[1]?.parts).toEqual([
      { type: 'text', id: expect.any(String), text: '1 2 3 4' },
    ]);
  });

  // A reset can take the thread while the reopen reads the session; one recreated here would skip the next replay.
  it('follows no turn for a session the store no longer holds', () => {
    const id = useChatStore.getState().resumeTurn('sess-gone');

    expect(id).toBe('');
    expect(useChatStore.getState().threads).toEqual({});
    expect(useChatStore.getState().streamingSessions).toEqual({});
  });

  // Live, such a failure points at Settings; the replay must say the same, and never sign the agent out.
  it('shows a replayed key refusal of one provider as one, for an agent with a key per provider', () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    try {
      openThread('sess-count');
      fire('sess-count', { type: 'user_message', delta: 'case 401' });
      fire('sess-count', {
        type: 'message_error',
        message:
          '{"code":-32603,"message":"401 Unauthorized: invalid x-api-key"}',
      });

      expect(messagesOf('sess-count')[1]).toMatchObject({
        status: 'error',
        error: '401 Unauthorized: invalid x-api-key',
        errorKind: 'auth',
      });
    } finally {
      useAiAssistantStore.setState({ selectedAgentId: undefined });
    }
  });

  // The host keeps only the outcome of the last turn: its reply, or a new one after an unanswered prompt, gets the mark.
  it('marks the last turn of a replayed chat failed or stopped', () => {
    openThread('sess-a');
    fire('sess-a', { type: 'user_message', delta: 'Count to 400' });
    fire('sess-a', { type: 'message_chunk', delta: '1 2 3' });
    openThread('sess-b');
    fire('sess-b', { type: 'user_message', delta: 'hello' });
    openThread('sess-c');
    fire('sess-c', { type: 'user_message', delta: 'Count to 900' });

    useChatStore.getState().markReplayedTurn('sess-a', 'error');
    useChatStore.getState().markReplayedTurn('sess-b', 'error');
    useChatStore.getState().markReplayedTurn('sess-c', 'cancelled');

    expect(messagesOf('sess-a')).toHaveLength(2);
    expect(messagesOf('sess-a')[1]).toMatchObject({
      status: 'error',
      errorKind: 'replayed',
    });
    expect(messagesOf('sess-b').map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(messagesOf('sess-b')[1]).toMatchObject({ status: 'error' });
    expect(messagesOf('sess-c')[1]).toMatchObject({
      role: 'assistant',
      cancelled: true,
    });
  });

  it('opens the reply after the prompt for a turn that has written nothing yet', () => {
    openThread('sess-count');
    fire('sess-count', { type: 'user_message', delta: 'Count to 1500' });

    const id = useChatStore.getState().resumeTurn('sess-count');

    const messages = messagesOf('sess-count');
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.id).toBe(id);
  });

  // The list reads made while the engine restarted failed, and the rows they left would keep a typing dot.
  it('reads the session list again once a restart has resumed the sessions', () => {
    const before = useChatStore.getState().sessionListVersion;
    const restart = (event: AgentRestart): void =>
      restartHandlers.forEach((handler) => handler(event));

    restart({ attempt: 1, max: 3, gaveUp: false });
    expect(useChatStore.getState().sessionListVersion).toBe(before);

    restart({ attempt: 1, max: 3, gaveUp: false, resumed: true });
    expect(useChatStore.getState().sessionListVersion).toBe(before + 1);
  });

  it('drops a permission request for a session nobody opened', () => {
    askPermission({ id: 'perm-1', sessionId: 'sess-gone', options: [] });

    expect(useChatStore.getState().threads).toEqual({});
  });
});

// The turn's own state: which message the stream appends to, and the meters the toolbar reads.
describe('chatStore — a turn', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('opens the assistant message the turn streams into', () => {
    useChatStore.getState().addUserText('sess-blink', 'Blink an LED on D13');
    const assistantId = useChatStore.getState().beginTurn('sess-blink');

    const state = useChatStore.getState();
    expect(state.threads['sess-blink']?.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(state.threads['sess-blink']?.streamingMessageId).toBe(assistantId);
    expect(state.threads['sess-blink']?.turnStartedAt).toBeTypeOf('number');
    expect(state.streamingSessions['sess-blink']).toBe(true);
  });

  // The count must follow the text on screen, so the adapter's consolidated re-send is not counted.
  it('counts the characters written this turn, once', () => {
    const id = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().appendThinking('sess-blink', id, 'plan');
    useChatStore.getState().appendText('sess-blink', id, 'hello ');
    useChatStore.getState().appendText('sess-blink', id, 'world');
    useChatStore.getState().appendText('sess-blink', id, 'hello world');

    const thread = useChatStore.getState().threads['sess-blink'];
    expect(thread?.turnOutChars).toBe('plan'.length + 'hello world'.length);
    useChatStore.getState().beginTurn('sess-blink');
    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(0);
  });

  // A turn's Go epilogue outlives a reset, so chunks arrive for a message the thread no longer holds.
  it('counts nothing for a message the thread no longer holds', () => {
    const id = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().appendText('sess-blink', id, 'kept');
    const kept = useChatStore.getState().threads['sess-blink']?.turnOutChars;

    useChatStore.getState().appendText('sess-blink', 'msg-gone', 'lost');
    useChatStore.getState().appendThinking('sess-blink', 'msg-gone', 'lost');
    useChatStore.getState().addToolCall('sess-blink', 'msg-gone', {
      id: 'call-gone',
      title: 'Write',
      kind: 'edit',
      status: 'pending',
      input: { content: 'a whole file nobody sees' },
    });

    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(
      kept,
    );
  });

  // An edit's new file content is written by the model, and arrives refined: only the growth is new.
  it('counts the arguments the model writes, and only their growth', () => {
    const id = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().addToolCall('sess-blink', id, {
      id: 'call-1',
      title: 'Write',
      kind: 'edit',
      status: 'pending',
      input: { path: 'sketch.ino' },
    });
    const afterAdd =
      useChatStore.getState().threads['sess-blink']?.turnOutChars;
    expect(afterAdd).toBe(JSON.stringify({ path: 'sketch.ino' }).length);

    const refined = { path: 'sketch.ino', content: 'void setup() {}' };
    useChatStore.getState().updateToolCall('sess-blink', id, 'call-1', {
      status: 'in_progress',
      input: refined,
    });
    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(
      JSON.stringify(refined).length,
    );

    // The tool's own output is what the agent read, not what it wrote.
    useChatStore.getState().updateToolCall('sess-blink', id, 'call-1', {
      status: 'completed',
      output: 'a very long file the agent read back',
    });
    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(
      JSON.stringify(refined).length,
    );
  });

  // Thinking arrives consolidated as well, and the guard is per part type: a wrong one double-counts.
  it('counts a consolidated thinking block once', () => {
    const id = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().appendThinking('sess-blink', id, 'I will ');
    useChatStore.getState().appendThinking('sess-blink', id, 'check D13');
    useChatStore
      .getState()
      .appendThinking('sess-blink', id, 'I will check D13');

    const thread = useChatStore.getState().threads['sess-blink'];
    expect(thread?.turnOutChars).toBe('I will check D13'.length);
    expect(thread?.messages[0]?.parts).toHaveLength(1);
  });

  // The engine can shorten the arguments as it refines them; the count must not run backwards.
  it('never subtracts when the arguments shrink', () => {
    const id = useChatStore.getState().beginTurn('sess-blink');
    const long = {
      path: 'sketch.ino',
      content: 'void setup() { pinMode(13, OUTPUT); }',
    };
    useChatStore.getState().addToolCall('sess-blink', id, {
      id: 'call-1',
      title: 'Write',
      kind: 'edit',
      status: 'pending',
      input: long,
    });
    const afterAdd =
      useChatStore.getState().threads['sess-blink']?.turnOutChars;

    useChatStore.getState().updateToolCall('sess-blink', id, 'call-1', {
      status: 'in_progress',
      input: { path: 'sketch.ino' },
    });

    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(
      afterAdd,
    );
  });

  // Ids repeat across turns: read from an earlier message's copy, a refinement reads as a shrink.
  it('measures a repeated tool-call id against its own message', () => {
    const earlier = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().addToolCall('sess-blink', earlier, {
      id: 'call-1',
      title: 'Write',
      kind: 'edit',
      status: 'completed',
      input: {
        path: 'sketch.ino',
        content: 'void setup() { pinMode(13, OUTPUT); }',
      },
    });
    useChatStore.getState().endTurn('sess-blink');

    const id = useChatStore.getState().beginTurn('sess-blink');
    const stub = { path: 'sketch.ino' };
    useChatStore.getState().addToolCall('sess-blink', id, {
      id: 'call-1',
      title: 'Write',
      kind: 'edit',
      status: 'pending',
      input: stub,
    });
    const refined = { path: 'sketch.ino', content: 'void loop() {}' };
    useChatStore.getState().updateToolCall('sess-blink', id, 'call-1', {
      status: 'in_progress',
      input: refined,
    });

    expect(useChatStore.getState().threads['sess-blink']?.turnOutChars).toBe(
      JSON.stringify(refined).length,
    );
    // The earlier message keeps its own arguments: the patch belongs to this turn's call.
    const messages = useChatStore.getState().threads['sess-blink']?.messages;
    const first = messages?.find((m) => m.id === earlier)?.parts[0];
    expect(first?.type === 'tool_call' && first.toolCall.input).toEqual({
      path: 'sketch.ino',
      content: 'void setup() { pinMode(13, OUTPUT); }',
    });
  });

  // A turn can run in the background after a switch, so two sessions must count their own output.
  it('counts the output of each session on its own thread', () => {
    const a = useChatStore.getState().beginTurn('sess-a');
    const b = useChatStore.getState().beginTurn('sess-b');
    useChatStore.getState().appendText('sess-a', a, 'aaa');
    useChatStore.getState().appendText('sess-b', b, 'bbbbbb');

    const { threads } = useChatStore.getState();
    expect(threads['sess-a']?.turnOutChars).toBe(3);
    expect(threads['sess-b']?.turnOutChars).toBe(6);
    // And a new turn in one leaves the other's count alone.
    useChatStore.getState().beginTurn('sess-a');
    expect(useChatStore.getState().threads['sess-a']?.turnOutChars).toBe(0);
    expect(useChatStore.getState().threads['sess-b']?.turnOutChars).toBe(6);
  });

  // An ended turn (finished, stopped or failed) can't answer a permission prompt either.
  it('clears the streaming flags and any pending permission when it ends', () => {
    useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().setPendingPermission('sess-blink', {
      id: 'perm-1',
      sessionId: 'sess-blink',
      options: [],
    });

    useChatStore.getState().endTurn('sess-blink');

    const state = useChatStore.getState();
    expect(state.streamingSessions['sess-blink']).toBeUndefined();
    expect(state.threads['sess-blink']?.streamingMessageId).toBeUndefined();
    expect(state.threads['sess-blink']?.pendingPermission).toBeUndefined();
  });

  // The turn the teardown killed settles against a wiped store; recreating its thread there would cost
  // the reopened session its replay.
  it('does not recreate a wiped thread when it settles', () => {
    useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().resetLoadedSessions();

    useChatStore.getState().endTurn('sess-blink');

    expect(useChatStore.getState().threads).toEqual({});
  });
});

// An app can go while no chat UI is mounted (My Apps, or the agent deleting it mid-turn), so the store
// subscribes for the whole session rather than leaving this to a panel's effect.
describe('chatStore — an app the host forgot', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    forgottenHandlers.length = 0;
    subscribeWorkspaceAppForgotten();
  });

  const forget = (appId: string): void => forgottenHandlers[0](appId);

  it('moves a chat open on the deleted app back to the whole board', () => {
    useChatStore
      .getState()
      .setLastSession('s-lamp', 'Lamp chat', { id: 'app-lamp', name: 'Lamp' });

    forget('app-lamp');

    const state = useChatStore.getState();
    expect(state.lastSessionId).toBeNull(); // nothing to resume: the chat went with the app
    expect(state.lastSessionByWorkspace['app-lamp']).toBeUndefined();
    expect(state.sessionRequest).toMatchObject({
      type: 'new',
      workspace: { id: '' },
    });
  });

  // The host keeps the chat whose turn deleted its app, about no app: the panel stays on it, on the whole board.
  it('keeps a chat open on the deleted app while its turn runs', () => {
    const store = useChatStore.getState();
    store.setLastSession('s-lamp', 'Lamp chat', {
      id: 'app-lamp',
      name: 'Lamp',
    });
    store.beginTurn('s-lamp');

    forget('app-lamp');

    const state = useChatStore.getState();
    expect(state.lastSessionId).toBe('s-lamp');
    expect(state.lastSessionWorkspaceId).toBe('');
    expect(state.lastSessionByWorkspace['app-lamp']).toBeUndefined();
    expect(state.lastSessionByWorkspace['']?.id).toBe('s-lamp');
    expect(state.sessionRequest).toEqual({
      type: 'open',
      session: { id: 's-lamp', title: 'Lamp chat' },
      nonce: expect.any(Number),
    });
  });

  it('leaves a chat open on another app where it is', () => {
    useChatStore
      .getState()
      .setLastSession('s-fan', 'Fan chat', { id: 'app-fan', name: 'Fan' });

    forget('app-lamp');

    const state = useChatStore.getState();
    expect(state.lastSessionId).toBe('s-fan');
    expect(state.sessionRequest).toBeUndefined(); // no panel has to move
  });

  // The remembered pointer is what a later mount would resume from, so it has to go even with nothing open.
  it("drops the deleted app's remembered session with no chat open", () => {
    useChatStore
      .getState()
      .setLastSession('s-lamp', 'Lamp chat', { id: 'app-lamp', name: 'Lamp' });
    useChatStore.getState().setLastSession('s-general', 'General', { id: '' });

    forget('app-lamp');

    const state = useChatStore.getState();
    expect(state.lastSessionByWorkspace['app-lamp']).toBeUndefined();
    expect(state.lastSessionByWorkspace['']?.id).toBe('s-general');
    expect(state.lastSessionId).toBe('s-general'); // the open chat is elsewhere; it stays
  });
});

// An agent rename remounts the editor on the new id, and the side panel there resumes a chat only if the pointers name it.
describe('chatStore — an app the agent renamed', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    renamedHandlers.length = 0;
    subscribeWorkspaceAppRenamed();
  });

  it('moves the chat to resume onto the new id', () => {
    useChatStore
      .getState()
      .setLastSession('s-lamp', 'Lamp chat', { id: 'app-lamp', name: 'Lamp' });

    renamedHandlers[0]('app-lamp', 'app-desk-lamp', 'Desk lamp');

    const state = useChatStore.getState();
    expect(state.lastSessionId).toBe('s-lamp');
    expect(state.lastSessionWorkspaceId).toBe('app-desk-lamp');
    expect(state.lastSessionWorkspaceName).toBe('Desk lamp');
    expect(state.lastSessionByWorkspace['app-desk-lamp']?.id).toBe('s-lamp');
    expect(state.lastSessionByWorkspace['app-lamp']).toBeUndefined();
  });
});

// The editor's side panel unmounts when it closes, and these used to be that panel's own state.
describe('chatStore — the turn meters', () => {
  const openThread = (id: string): void => {
    useChatStore.getState().reset();
    useChatStore
      .getState()
      .addMessage(id, { id: 'm1', role: 'user', parts: [] });
  };

  it('keeps the clock and the count on the session, where no unmount reaches them', () => {
    openThread('sess-blink');
    const id = useChatStore.getState().beginTurn('sess-blink');
    useChatStore.getState().appendText('sess-blink', id, 'Blinking D13');

    // What a remounted panel reads back.
    const thread = useChatStore.getState().threads['sess-blink'];
    expect(thread?.turnOutChars).toBe('Blinking D13'.length);
    expect(thread?.turnStartedAt).toBeTypeOf('number');
  });
});

// A prompt typed while the turn runs is held here until it ends; order and per-session isolation are the contract.
describe('useChatStore prompt queue', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it('sends queued prompts oldest first, and keeps each session apart', () => {
    const store = useChatStore.getState();
    store.enqueuePrompt('sess-a', 'q1', 'first');
    store.enqueuePrompt('sess-a', 'q2', 'second');
    store.enqueuePrompt('sess-b', 'q3', 'other session');

    expect(useChatStore.getState().dequeuePrompt('sess-a')?.text).toBe('first');
    expect(useChatStore.getState().dequeuePrompt('sess-a')?.text).toBe(
      'second',
    );
    expect(useChatStore.getState().dequeuePrompt('sess-a')).toBeUndefined();
    expect(useChatStore.getState().queuedPrompts['sess-b']).toHaveLength(1);
  });

  it('drops a queued prompt the user removed before it was sent', () => {
    const store = useChatStore.getState();
    store.enqueuePrompt('sess-a', 'q1', 'keep me');
    store.enqueuePrompt('sess-a', 'q2', 'drop me');

    useChatStore.getState().removeQueuedPrompt('sess-a', 'q2');

    expect(useChatStore.getState().dequeuePrompt('sess-a')?.text).toBe(
      'keep me',
    );
    expect(useChatStore.getState().queuedPrompts['sess-a']).toBeUndefined();
  });

  // A blank prompt would send an empty turn the moment the current one ends.
  it('refuses to queue a blank prompt', () => {
    useChatStore.getState().enqueuePrompt('sess-a', 'q1', '   ');

    expect(useChatStore.getState().queuedPrompts['sess-a']).toBeUndefined();
  });

  it('drops every prompt of one session with Clear all', () => {
    const store = useChatStore.getState();
    store.enqueuePrompt('sess-a', 'q1', 'first');
    store.enqueuePrompt('sess-a', 'q2', 'second');
    store.enqueuePrompt('sess-b', 'q3', 'another chat');

    useChatStore.getState().clearQueuedPrompts('sess-a');

    expect(useChatStore.getState().queuedPrompts['sess-a']).toBeUndefined();
    expect(useChatStore.getState().queuedPrompts['sess-b']).toHaveLength(1);
  });

  it('forgets the queue of a session that was deleted', () => {
    useChatStore.getState().enqueuePrompt('sess-a', 'q1', 'pending');

    useChatStore.getState().discardThread('sess-a');

    expect(useChatStore.getState().queuedPrompts['sess-a']).toBeUndefined();
  });

  // A replaced agent process has no turn left to drain them, so they must not fire into the next one.
  it('forgets every queue when the agent process is replaced', () => {
    useChatStore.getState().enqueuePrompt('sess-a', 'q1', 'pending');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().queuedPrompts).toEqual({});
  });
});

// No engine reports its output while it writes, so the counter is an estimate from what it has written.
describe('estimateOutputTokens', () => {
  it('reads the measured characters to a token', () => {
    expect(estimateOutputTokens(3200)).toBe(1000);
  });

  it('is zero before anything is written', () => {
    expect(estimateOutputTokens(0)).toBe(0);
  });
});

// The dot is red until the user reads the failure: while the session is open it stays, leaving it is the read.
describe('chatStore — a failed turn the user has read', () => {
  beforeEach((): VoidFunction => {
    useChatStore.getState().reset();
    markSessionRead.mockClear();
    return subscribeSessionReads();
  });

  const failed = (id: string): ChatMessage => ({
    id,
    role: 'assistant',
    parts: [],
    status: 'error',
  });
  const answered = (id: string): ChatMessage => ({
    id,
    role: 'assistant',
    parts: [],
    status: 'complete',
  });

  it('keeps the dot red for a failure only while it is the latest turn', () => {
    expect(lastTurnFailed([failed('a1')])).toBe(true);
    expect(
      lastTurnFailed([
        failed('a1'),
        { id: 'u2', role: 'user', parts: [] },
        answered('a2'),
      ]),
    ).toBe(false);
    expect(lastTurnFailed(undefined)).toBe(false);
  });

  it('marks the session the user leaves as read', () => {
    const store = useChatStore.getState();
    store.setCurrentSessionId('s1');
    expect(markSessionRead).not.toHaveBeenCalled();

    store.setCurrentSessionId('s2');
    expect(markSessionRead).toHaveBeenCalledWith('s1');

    store.setCurrentSessionId(null); // a new chat leaves s2 as well
    expect(markSessionRead).toHaveBeenLastCalledWith('s2');
  });

  it('refetches the list once a failure was cleared, so its row stops being red', async () => {
    markSessionRead.mockResolvedValueOnce(true);
    const store = useChatStore.getState();
    store.setCurrentSessionId('s1');
    const before = useChatStore.getState().sessionListVersion;

    store.setCurrentSessionId('s2');
    await vi.waitFor(() =>
      expect(useChatStore.getState().sessionListVersion).toBe(before + 1),
    );
  });

  // A switch resets the chat after the next engine has started, and that engine has no record of the session.
  it('marks nothing when a reset leaves the session', () => {
    const store = useChatStore.getState();
    store.setCurrentSessionId('s1');

    store.reset();
    store.resetLoadedSessions();

    expect(markSessionRead).not.toHaveBeenCalled();
  });

  it('marks the open session read on request, while its engine still runs', async () => {
    markSessionRead.mockResolvedValueOnce(true);
    useChatStore.getState().setCurrentSessionId('s1');
    const before = useChatStore.getState().sessionListVersion;

    await readOpenSession();

    expect(markSessionRead).toHaveBeenCalledWith('s1');
    expect(useChatStore.getState().sessionListVersion).toBe(before + 1);
  });

  it('marks nothing on an update that keeps the same session', () => {
    const store = useChatStore.getState();
    store.setCurrentSessionId('s1');
    store.addMessage('s1', { id: 'm1', role: 'user', parts: [] });
    store.setCurrentSessionId('s1');
    expect(markSessionRead).not.toHaveBeenCalled();
  });
});
