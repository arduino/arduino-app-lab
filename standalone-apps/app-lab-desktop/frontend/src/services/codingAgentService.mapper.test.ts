import { describe, expect, it } from 'vitest';

import {
  mapPermissionRequest,
  mapRestart,
  mapSessionState,
  mapUpdate,
  WirePermissionRequest,
  WireUpdate,
} from './codingAgentService.mapper';

describe('mapUpdate', () => {
  it('maps a message chunk', () => {
    expect(mapUpdate({ type: 'message_chunk', delta: 'hi' })).toEqual({
      type: 'message_chunk',
      delta: 'hi',
    });
  });

  it('maps a tool_call, passing kind through and omitting absent output', () => {
    const u: WireUpdate = {
      type: 'tool_call',
      toolCall: {
        id: 't1',
        title: 'List boards',
        kind: 'execute',
        status: 'pending',
      },
    };
    expect(mapUpdate(u)).toEqual({
      type: 'tool_call',
      toolCall: {
        id: 't1',
        title: 'List boards',
        kind: 'execute',
        status: 'pending',
      },
    });
  });

  it('maps a tool_call_update, defaulting an absent status to pending', () => {
    expect(
      mapUpdate({ type: 'tool_call_update', id: 't1', output: '2 boards' }),
    ).toEqual({
      type: 'tool_call_update',
      id: 't1',
      status: 'pending',
      output: '2 boards',
    });
  });

  it('forwards tool_call rawInput and tool_call_update input', () => {
    expect(
      mapUpdate({
        type: 'tool_call',
        toolCall: {
          id: 't1',
          title: 'Bash',
          status: 'pending',
          input: { command: 'ls' },
        },
      }),
    ).toEqual({
      type: 'tool_call',
      toolCall: {
        id: 't1',
        title: 'Bash',
        kind: '',
        status: 'pending',
        input: { command: 'ls' },
      },
    });
    expect(
      mapUpdate({ type: 'tool_call_update', id: 't1', input: { command: 'ls -la' } }),
    ).toEqual({
      type: 'tool_call_update',
      id: 't1',
      status: 'pending',
      input: { command: 'ls -la' },
    });
  });

  it('maps a thinking delta', () => {
    expect(mapUpdate({ type: 'thinking', delta: 'hmm' })).toEqual({
      type: 'thinking',
      delta: 'hmm',
    });
  });

  it('maps a checklist, defaulting an unknown item status to pending', () => {
    const u: WireUpdate = {
      type: 'checklist',
      checklist: {
        id: 'plan',
        title: 'Plan',
        items: [
          { label: 'Step 1', status: 'completed' },
          { label: 'Step 2', status: 'weird' },
        ],
      },
    };
    expect(mapUpdate(u)).toEqual({
      type: 'checklist',
      checklist: {
        id: 'plan',
        title: 'Plan',
        items: [
          { label: 'Step 1', status: 'completed' },
          { label: 'Step 2', status: 'pending' },
        ],
      },
    });
  });

  it('returns null for unmodelled update kinds', () => {
    expect(mapUpdate({ type: 'plan' })).toBeNull();
  });
});

describe('mapPermissionRequest', () => {
  it('passes options (id/label/kind) and the tool-call straight through', () => {
    const req: WirePermissionRequest = {
      id: 'perm-1',
      sessionId: 's1',
      toolCall: {
        id: 'tc1',
        title: 'Write file',
        kind: 'edit',
        status: 'pending',
      },
      options: [
        { id: 'opt-allow', label: 'Allow', kind: 'allow_once' },
        { id: 'opt-reject', label: 'Reject', kind: 'reject_once' },
      ],
      timeoutMs: 60000,
    };
    expect(mapPermissionRequest(req)).toEqual({
      id: 'perm-1',
      sessionId: 's1',
      toolCall: {
        id: 'tc1',
        title: 'Write file',
        kind: 'edit',
        status: 'pending',
      },
      options: [
        { id: 'opt-allow', label: 'Allow', kind: 'allow_once' },
        { id: 'opt-reject', label: 'Reject', kind: 'reject_once' },
      ],
      timeoutMs: 60000,
    });
  });

  it('defaults options to [] and omits an absent toolCall/timeout', () => {
    expect(mapPermissionRequest({ id: 'p2', sessionId: 's1' })).toEqual({
      id: 'p2',
      sessionId: 's1',
      options: [],
    });
  });
});

describe('mapSessionState', () => {
  it('defaults status to idle and omits absent model/pending', () => {
    expect(mapSessionState({ sessionId: 's1' })).toEqual({
      sessionId: 's1',
      status: 'idle',
    });
  });

  it('maps streaming status, model and pending permission', () => {
    const state = mapSessionState({
      sessionId: 's1',
      status: 'streaming',
      modelId: 'opus',
      pendingPermission: {
        id: 'perm-1',
        sessionId: 's1',
        options: [{ id: 'opt-allow', label: 'Allow', kind: 'allow_once' }],
      },
    });
    expect(state.status).toBe('streaming');
    expect(state.modelId).toBe('opus');
    expect(state.pendingPermission?.options).toEqual([
      { id: 'opt-allow', label: 'Allow', kind: 'allow_once' },
    ]);
  });
});

describe('mapRestart', () => {
  it('maps an in-progress restart attempt', () => {
    expect(mapRestart({ attempt: 2, max: 3, gaveUp: false })).toEqual({
      attempt: 2,
      max: 3,
      gaveUp: false,
    });
  });

  it('maps the give-up event that ends the restart budget', () => {
    expect(mapRestart({ attempt: 3, max: 3, gaveUp: true }).gaveUp).toBe(true);
  });

  // A malformed payload must never read as a give-up: that would blank the chat and drop every
  // in-memory thread on an agent that is actually fine.
  it('defaults absent fields without inventing a give-up', () => {
    expect(mapRestart({})).toEqual({ attempt: 0, max: 0, gaveUp: false });
  });
});
