import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAssistantStore, useChatStore } from '../../store';
import { restartForNewCredential } from './restartForNewCredential';

// Order matters more than the individual calls here, so the doubles record it (see beforeEach).
const agent = vi.hoisted(() => ({
  calls: [] as string[],
  start: vi.fn<[string], Promise<void>>(),
  stop: vi.fn<[], Promise<void>>(),
}));

vi.mock('../../services', () => ({ start: agent.start, stop: agent.stop }));

// The credential reaches the agent only through its process environment at spawn, and AgentStart is a
// no-op while a process is already running — so re-authenticating has to replace that process, or the
// revoked credential stays in it and the user loops back through the login screen.
describe('restartForNewCredential', () => {
  beforeEach(() => {
    agent.calls.length = 0;
    // mockReset drops any per-test override (a rejection), so each test starts from the recording pair.
    agent.start.mockReset().mockImplementation((agentId) => {
      agent.calls.push(`start:${agentId}`);
      return Promise.resolve();
    });
    agent.stop.mockReset().mockImplementation(() => {
      agent.calls.push('stop');
      return Promise.resolve();
    });
    useChatStore.getState().reset();
    useAiAssistantStore.getState().setAgentDown(false);
  });

  // Leaves the chat as an expired session would: a thread in memory for the session it was showing.
  const openSession = (id: string, title: string): void => {
    const store = useChatStore.getState();
    store.setLastSession(id, title);
    store.addMessage(id, { id: 'm1', role: 'user', parts: [] });
  };

  it('stops the agent before starting it, so the new credential is picked up at spawn', async () => {
    await restartForNewCredential('claude');

    expect(agent.calls).toEqual(['stop', 'start:claude']);
  });

  it('drops the loaded threads but reopens the same session', async () => {
    openSession('sess-blink', 'Blink an LED on D13');

    await restartForNewCredential('claude');

    const chat = useChatStore.getState();
    // A surviving thread would make bootstrap skip its loadSession replay and then prompt a session id
    // the replacement process has never loaded.
    expect(chat.threads).toEqual({});
    expect(chat.lastSessionId).toBe('sess-blink');
    expect(chat.lastSessionTitle).toBe('Blink an LED on D13');
  });

  it('clears agentDown, since the process that gave up has been replaced', async () => {
    useAiAssistantStore.getState().setAgentDown(true);

    await restartForNewCredential('claude');

    expect(useAiAssistantStore.getState().agentDown).toBe(false);
  });

  // Go frees its manager slot even when the teardown itself errors, so the start below still spawns a
  // fresh process — failing here would block a sign-in that is otherwise fine.
  it('starts anyway when stopping fails', async () => {
    agent.stop.mockRejectedValue(new Error('stop failed'));

    await restartForNewCredential('claude');

    expect(agent.calls).toEqual(['start:claude']);
  });

  // The caller reports the failure and keeps the user on the connect screen; wiping the chat first would
  // cost them the session they were in for a sign-in that never took effect.
  it('leaves the chat untouched when the agent will not start', async () => {
    openSession('sess-blink', 'Blink an LED on D13');
    useAiAssistantStore.getState().setAgentDown(true);
    agent.start.mockRejectedValue(new Error('ai runtime not installed'));

    await expect(restartForNewCredential('claude')).rejects.toThrow(
      'ai runtime not installed',
    );

    expect(useChatStore.getState().threads).toHaveProperty('sess-blink');
    expect(useAiAssistantStore.getState().agentDown).toBe(true);
  });
});
