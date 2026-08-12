import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from './chatStore';

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
    store.setSessionStreaming(id, true);
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
  it('forgets the session to reopen when it was an unprompted draft', () => {
    openSession('sess-draft', 'New chat');
    useChatStore.getState().setDraftSessionId('sess-draft');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionId).toBeNull();
    expect(useChatStore.getState().lastSessionTitle).toBeUndefined();
  });

  it('keeps the session to reopen when the draft is a different one', () => {
    openSession('sess-blink', 'Blink an LED on D13');
    useChatStore.getState().setDraftSessionId('sess-other');

    useChatStore.getState().resetLoadedSessions();

    expect(useChatStore.getState().lastSessionId).toBe('sess-blink');
    expect(useChatStore.getState().draftSessionId).toBeNull();
  });
});
