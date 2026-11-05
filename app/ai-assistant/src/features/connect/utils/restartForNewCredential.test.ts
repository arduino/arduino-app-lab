import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAssistantStore, useChatStore } from '../../../store';
import {
  restartAfterTurns,
  restartForNewCredential,
} from './restartForNewCredential';

// Order matters more than the individual calls here, so the doubles record it (see beforeEach).
const agent = vi.hoisted(() => ({
  calls: [] as string[],
  start: vi.fn<(agentId: string) => Promise<void>>(),
  stop: vi.fn<() => Promise<void>>(),
  switchAgent: vi.fn<(agentId: string) => Promise<void>>(),
  setDefaultAgent: vi.fn<(agentId: string) => Promise<void>>(),
  markSessionRead: vi.fn<(sessionId: string) => Promise<boolean>>(),
}));

vi.mock('../../../services', () => ({
  start: agent.start,
  stop: agent.stop,
  switchAgent: agent.switchAgent,
  setDefaultAgent: agent.setDefaultAgent,
  markSessionRead: agent.markSessionRead,
}));

// Leaves the chat as an expired session would: a thread in memory for the session it was showing.
const openSession = (id: string, title: string): void => {
  const store = useChatStore.getState();
  store.setLastSession(id, title);
  store.addMessage(id, { id: 'm1', role: 'user', parts: [] });
};

// Every pending promise callback runs before a timer does.
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

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
    agent.switchAgent.mockReset().mockImplementation((agentId) => {
      agent.calls.push(`switch:${agentId}`);
      return Promise.resolve();
    });
    agent.setDefaultAgent.mockReset().mockImplementation((agentId) => {
      agent.calls.push(`default:${agentId}`);
      return Promise.resolve();
    });
    agent.markSessionRead.mockReset().mockImplementation((sessionId) => {
      agent.calls.push(`read:${sessionId}`);
      return Promise.resolve(false);
    });
    useChatStore.getState().reset();
    useAiAssistantStore.setState({
      agentDown: undefined,
      credentialRestart: undefined,
    });
  });

  // Only the engine that recorded a failure can clear it, and the switch stops that engine.
  it('marks the chat on screen read before switching to another agent', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    useChatStore.setState({ currentSessionId: 'ses-open' });

    await restartForNewCredential('claude');

    expect(agent.calls.slice(0, 2)).toEqual(['read:ses-open', 'switch:claude']);
  });

  // stop+start alone left the arriving agent holding the previous one's workspace.
  it('switches, stops and starts, in that order', async () => {
    await restartForNewCredential('claude');

    expect(agent.calls).toEqual([
      'switch:claude',
      'stop',
      'start:claude',
      'default:claude',
    ]);
  });

  // A refusal means edits exist only in the mirror; swallowing it would sign in and empty nothing.
  it('does not start when the switch refuses', async () => {
    agent.switchAgent.mockRejectedValueOnce(
      new Error('cannot switch agent yet'),
    );
    await expect(restartForNewCredential('claude')).rejects.toThrow(
      'cannot switch agent yet',
    );
    expect(agent.calls).toEqual([]);
  });

  // A refusal before Go stopped anything leaves the agent running with its sessions, its turns and their queues.
  it('keeps the loaded threads when the switch is refused before anything stopped', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    openSession('sess-blink', 'Blink an LED on D13');
    useChatStore.getState().beginTurn('sess-other');
    useChatStore.getState().enqueuePrompt('sess-other', 'q1', 'and then?');
    agent.switchAgent.mockRejectedValueOnce(
      new Error('cannot switch agent yet: a chat is still answering'),
    );

    await expect(restartForNewCredential('opencode')).rejects.toThrow(
      'cannot switch agent yet',
    );

    const chat = useChatStore.getState();
    expect(chat.threads).toHaveProperty('sess-blink');
    expect(chat.streamingSessions).toEqual({ 'sess-other': true });
    expect(chat.queuedPrompts['sess-other']).toHaveLength(1);
    expect(useAiAssistantStore.getState().agentDown).toBeUndefined();
    expect(useAiAssistantStore.getState().credentialRestart).toBeUndefined();
  });

  // Go stopped the agent in use for the switch, then started it again as a new process with no session loaded, or could not.
  it.each(['agent_switch_unsaved_edits', 'agent_switch_failed'])(
    'on %s, drops the loaded threads when Go restarted the agent it kept or could not, and names it down when it could not',
    async (code) => {
      const refusal = (fields: object): Error =>
        new Error(
          JSON.stringify({
            code,
            message: 'cannot switch agent yet',
            apps: ['Blink'],
            ...fields,
          }),
        );
      useAiAssistantStore.setState({ selectedAgentId: 'claude' });
      openSession('sess-blink', 'Blink an LED on D13');

      // Go sends one flag or the other; either way the process that held the sessions is gone.
      agent.switchAgent.mockRejectedValueOnce(refusal({ restartFailed: true }));
      await expect(restartForNewCredential('opencode')).rejects.toThrow();
      expect(useChatStore.getState().threads).toEqual({});
      expect(useChatStore.getState().lastSessionId).toBe('sess-blink');
      // The stopped prompt offers Reconnect.
      expect(useAiAssistantStore.getState().agentDown).toEqual({
        agentId: 'claude',
        reason: 'start-failed',
      });
      expect(useAiAssistantStore.getState().selectedAgentId).toBe('claude');

      useAiAssistantStore.setState({ agentDown: undefined });
      openSession('sess-blink', 'Blink an LED on D13');
      agent.switchAgent.mockRejectedValueOnce(refusal({ restarted: true }));
      await expect(restartForNewCredential('opencode')).rejects.toThrow();

      const chat = useChatStore.getState();
      expect(chat.threads).toEqual({});
      expect(chat.lastSessionId).toBe('sess-blink');
      expect(useAiAssistantStore.getState().agentDown).toBeUndefined();
    },
  );

  // Left to a later probe, the probe picked the default and pointed the interface at the wrong agent.
  it('names the agent it started', async () => {
    useAiAssistantStore.setState({ selectedAgentId: undefined });
    await restartForNewCredential('claude');
    expect(useAiAssistantStore.getState().selectedAgentId).toBe('claude');
  });

  it('drops the loaded threads but reopens the same session', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    openSession('sess-blink', 'Blink an LED on D13');
    const before = useChatStore.getState().sessionGeneration;

    await restartForNewCredential('claude');

    const chat = useChatStore.getState();
    // A surviving thread would make bootstrap skip its loadSession replay and then prompt a session id
    // the replacement process has never loaded.
    expect(chat.threads).toEqual({});
    expect(chat.lastSessionId).toBe('sess-blink');
    expect(chat.lastSessionTitle).toBe('Blink an LED on D13');
    // One bump here too: the second one opened a second session beside the one being reopened.
    expect(chat.sessionGeneration).toBe(before + 1);
  });

  // The other engine has never heard of that session, and the second reset then opened a second one.
  it('drops the remembered session when the engine changes, in one bump', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    openSession('sess-blink', 'Blink an LED on D13');
    const before = useChatStore.getState().sessionGeneration;

    await restartForNewCredential('opencode');

    const chat = useChatStore.getState();
    expect(chat.threads).toEqual({});
    expect(chat.lastSessionId).toBeNull();
    expect(chat.lastSessionTitle).toBeUndefined();
    expect(chat.sessionGeneration).toBe(before + 1);
  });

  it('clears agentDown, since the process that gave up has been replaced', async () => {
    useAiAssistantStore
      .getState()
      .setAgentDown({ agentId: 'claude', reason: 'crashed' });

    await restartForNewCredential('claude');

    expect(useAiAssistantStore.getState().agentDown).toBeUndefined();
  });

  // Go frees its manager slot even when the teardown itself errors, so the start below still spawns a
  // fresh process — failing here would block a sign-in that is otherwise fine.
  it('starts anyway when stopping fails', async () => {
    agent.stop.mockRejectedValue(new Error('stop failed'));

    await restartForNewCredential('claude');

    expect(agent.calls).toEqual([
      'switch:claude',
      'start:claude',
      'default:claude',
    ]);
  });

  // The caller reports the failure and keeps the user on the connect screen, so the session they were in
  // stays the one to reopen. Its thread goes: the stopped process had it loaded, and Reconnect only starts.
  it('keeps the session to reopen but not its loaded thread when the agent will not start', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    openSession('sess-blink', 'Blink an LED on D13');
    useAiAssistantStore
      .getState()
      .setAgentDown({ agentId: 'claude', reason: 'crashed' });
    agent.start.mockRejectedValue(new Error('ai runtime not installed'));

    await expect(restartForNewCredential('claude')).rejects.toThrow(
      'ai runtime not installed',
    );

    const chat = useChatStore.getState();
    expect(chat.threads).toEqual({});
    expect(chat.lastSessionId).toBe('sess-blink');
    // One failed start is not a crash loop, and the stopped prompt must not say it crashed too many times.
    expect(useAiAssistantStore.getState().agentDown).toEqual({
      agentId: 'claude',
      reason: 'start-failed',
    });
  });

  // The switch went through before the start failed: after Reconnect a kept thread would skip loadSession
  // and prompt OpenCode with a Claude session id.
  it('drops the remembered session when the other agent will not start', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    openSession('sess-blink', 'Blink an LED on D13');
    agent.start.mockRejectedValue(new Error('opencode exited at startup'));

    await expect(restartForNewCredential('opencode')).rejects.toThrow(
      'opencode exited at startup',
    );

    const chat = useChatStore.getState();
    expect(chat.threads).toEqual({});
    expect(chat.lastSessionId).toBeNull();
    expect(useAiAssistantStore.getState().agentDown).toEqual({
      agentId: 'opencode',
      reason: 'start-failed',
    });
    expect(useAiAssistantStore.getState().selectedAgentId).toBe('opencode');
  });

  // The respawn that hands a new key to the engine would kill the answer being written.
  it('restarts for a key change only once every turn has ended', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    useChatStore.getState().beginTurn('sess-blink');
    let phaseAtStart: string | undefined;
    agent.start.mockImplementationOnce((agentId) => {
      phaseAtStart = useAiAssistantStore.getState().credentialRestart?.phase;
      agent.calls.push(`start:${agentId}`);
      return Promise.resolve();
    });

    const restarted = restartAfterTurns('opencode');
    // A second key added during the same turn reaches the engine with the same restart.
    const second = restartAfterTurns('opencode');
    await settle();
    expect(useAiAssistantStore.getState().credentialRestart).toEqual({
      agentId: 'opencode',
      phase: 'waiting',
    });
    expect(agent.calls).toEqual([]);

    // A queued prompt starts its turn in the same tick the last one ends.
    useChatStore.getState().endTurn('sess-blink');
    useChatStore.getState().beginTurn('sess-blink');
    await settle();
    expect(agent.calls).toEqual([]);

    useChatStore.getState().endTurn('sess-blink');
    expect(await Promise.all([restarted, second])).toEqual([true, true]);
    expect(agent.calls).toEqual([
      'switch:opencode',
      'stop',
      'start:opencode',
      'default:opencode',
    ]);
    // The chat holds Send while the engine is replaced, and lets go once it is back.
    expect(phaseAtStart).toBe('restarting');
    expect(useAiAssistantStore.getState().credentialRestart).toBeUndefined();
  });

  // The agent the key was for is no longer running: restarting it would switch the user back to it.
  it('skips the restart when another agent is in use once the turn ends', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    useChatStore.getState().beginTurn('sess-blink');

    const restarted = restartAfterTurns('opencode');
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    useChatStore.getState().endTurn('sess-blink');

    expect(await restarted).toBe(false);
    expect(agent.calls).toEqual([]);
    expect(useAiAssistantStore.getState().credentialRestart).toBeUndefined();
  });

  // The stopped prompt waits for the user's Reconnect, and that start reads the new key too.
  it('skips the restart when the agent gave up while it waited', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    useChatStore.getState().beginTurn('sess-blink');

    const restarted = restartAfterTurns('opencode');
    // What a give-up does: the reset ends the turn, then the agent is named down.
    useChatStore.getState().resetLoadedSessions();
    useAiAssistantStore
      .getState()
      .setAgentDown({ agentId: 'opencode', reason: 'crashed' });

    expect(await restarted).toBe(false);
    expect(agent.calls).toEqual([]);
    expect(useAiAssistantStore.getState().agentDown).toEqual({
      agentId: 'opencode',
      reason: 'crashed',
    });
  });

  it('restarts at once when no turn is in flight', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });

    expect(await restartAfterTurns('opencode')).toBe(true);

    expect(agent.calls).toEqual([
      'switch:opencode',
      'stop',
      'start:opencode',
      'default:opencode',
    ]);
  });

  // A second stop and start under the first would stop the engine it is starting, and the first end would give Send back.
  it('runs the key changes made during a restart after it, once, and holds Send until the last ends', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'opencode' });
    let finishStart: VoidFunction = () => undefined;
    agent.start.mockImplementationOnce((agentId) => {
      agent.calls.push(`start:${agentId}`);
      return new Promise<void>((resolve) => {
        finishStart = resolve;
      });
    });

    const first = restartAfterTurns('opencode');
    await settle();
    expect(agent.calls).toEqual(['switch:opencode', 'stop', 'start:opencode']);

    // Both land after the new process may have read its keys, and one more restart reads them all.
    const second = restartAfterTurns('opencode');
    const third = restartAfterTurns('opencode');
    await settle();
    expect(agent.calls).toEqual(['switch:opencode', 'stop', 'start:opencode']);

    finishStart();
    expect(await first).toBe(true);
    expect(useAiAssistantStore.getState().credentialRestart?.phase).toBe(
      'restarting',
    );

    expect(await Promise.all([second, third])).toEqual([true, true]);
    expect(agent.calls).toEqual([
      'switch:opencode',
      'stop',
      'start:opencode',
      'default:opencode',
      'switch:opencode',
      'stop',
      'start:opencode',
      'default:opencode',
    ]);
    expect(useAiAssistantStore.getState().credentialRestart).toBeUndefined();
  });
});
