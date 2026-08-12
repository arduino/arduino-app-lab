import { PermissionRequest } from '@cloud-editor-mono/ai-assistant';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked Wails surface: bindings as spies + an event registry we can fire by hand.
const { app, runtime } = vi.hoisted(() => {
  const eventHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    app: {
      AgentStart: vi.fn(async () => undefined),
      AgentStop: vi.fn(async () => undefined),
      AgentNewSession: vi.fn(async () => 'sess-1'),
      AgentPrompt: vi.fn(async () => undefined),
      AgentCancel: vi.fn(async () => undefined),
      AgentCloseSession: vi.fn(async () => undefined),
      AgentSetSessionModel: vi.fn(async () => undefined),
      AgentPermissionReply: vi.fn(async () => undefined),
      AgentSignIn: vi.fn(async () => undefined),
      AgentGetSessionState: vi.fn(async () => ({
        sessionId: 's1',
        status: 'streaming',
        modelId: 'claude-opus-4-6',
        models: [
          { id: 'claude-opus-4-6', name: 'Opus' },
          { id: 'claude-haiku-4-5', name: 'Haiku' },
        ],
        pendingPermission: {
          id: 'perm-1',
          sessionId: 's1',
          options: [{ id: 'opt-allow', label: 'Allow', kind: 'allow_once' }],
        },
      })),
    },
    runtime: {
      eventHandlers,
      EventsOn: vi.fn(
        (name: string, cb: (...args: unknown[]) => void): (() => void) => {
          eventHandlers[name] = cb;
          return (): void => {
            delete eventHandlers[name];
          };
        },
      ),
    },
  };
});

vi.mock('../../wailsjs/go/app/App', () => app);
vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: runtime.EventsOn,
}));
vi.mock('../../wailsjs/go/models', () => ({
  agent: {
    PermissionOutcome: class {
      optionId?: string;
      cancelled?: boolean;
      constructor(src: { optionId?: string; cancelled?: boolean } = {}) {
        this.optionId = src.optionId;
        this.cancelled = src.cancelled;
      }
    },
  },
}));

import * as svc from './codingAgentService.impl.standalone';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('codingAgentService.impl — commands', () => {
  it('forwards start/stop/prompt/cancel to the matching bindings', async () => {
    await svc.start('claude');
    await svc.stop();
    await svc.prompt('s1', 'hello');
    await svc.cancel('s1');
    await svc.closeSession('s1');
    expect(app.AgentStart).toHaveBeenCalledWith('claude');
    expect(app.AgentStop).toHaveBeenCalled();
    expect(app.AgentPrompt).toHaveBeenCalledWith('s1', 'hello');
    expect(app.AgentCancel).toHaveBeenCalledWith('s1');
    expect(app.AgentCloseSession).toHaveBeenCalledWith('s1');
  });

  it('newSession passes the appId as cwd (empty string when absent)', async () => {
    await svc.newSession();
    expect(app.AgentNewSession).toHaveBeenLastCalledWith('');
    await svc.newSession('my-app');
    expect(app.AgentNewSession).toHaveBeenLastCalledWith('my-app');
  });
});

describe('codingAgentService.impl — permission (direct ACP pass-through)', () => {
  it('forwards the chosen outcome straight to AgentPermissionReply', () => {
    svc.permissionReply('perm-1', { optionId: 'opt-allow' });
    expect(app.AgentPermissionReply).toHaveBeenCalledWith(
      'perm-1',
      expect.objectContaining({ optionId: 'opt-allow' }),
    );
    svc.permissionReply('perm-2', { cancelled: true });
    expect(app.AgentPermissionReply).toHaveBeenCalledWith(
      'perm-2',
      expect.objectContaining({ cancelled: true }),
    );
  });

  it('maps the acp:permission event through to the handler (options pass through)', () => {
    const received: PermissionRequest[] = [];
    svc.onPermission((r) => received.push(r));
    runtime.eventHandlers['acp:permission']({
      id: 'perm-1',
      sessionId: 's1',
      options: [{ id: 'opt-allow', label: 'Allow', kind: 'allow_once' }],
    });
    expect(received[0].options).toEqual([
      { id: 'opt-allow', label: 'Allow', kind: 'allow_once' },
    ]);
  });
});

describe('codingAgentService.impl — events', () => {
  it('forwards mapped updates from the acp:update event', () => {
    const updates: Array<{ sid: string; type: string }> = [];
    svc.onUpdate((sid, u) => updates.push({ sid, type: u.type }));
    runtime.eventHandlers['acp:update']('s1', {
      type: 'message_chunk',
      delta: 'hi',
    });
    expect(updates).toEqual([{ sid: 's1', type: 'message_chunk' }]);
  });
});

describe('codingAgentService.impl — restart', () => {
  it('forwards the acp:restart give-up to the handler', () => {
    const seen: boolean[] = [];
    svc.onRestart((r) => seen.push(r.gaveUp));
    runtime.eventHandlers['acp:restart']({ attempt: 1, max: 3, gaveUp: false });
    runtime.eventHandlers['acp:restart']({ attempt: 3, max: 3, gaveUp: true });
    expect(seen).toEqual([false, true]);
  });
});

describe('codingAgentService.impl — sign-in', () => {
  it('runs the agent CLI login and reports success', async () => {
    expect(await svc.authenticate('claude')).toEqual({ ok: true });
    expect(app.AgentSignIn).toHaveBeenCalledWith('claude');
  });

  it('reports failure when the login fails', async () => {
    app.AgentSignIn.mockRejectedValueOnce(new Error('login failed'));
    const res = await svc.authenticate('claude');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('login failed');
  });
});

describe('codingAgentService.impl — degraded methods (not wired yet)', () => {
  it('reports not-authenticated status and returns empty collections', async () => {
    expect(await svc.getAuthStatus()).toEqual({ authenticated: false });
    expect(await svc.listModels()).toEqual([]);
  });
});

describe('codingAgentService.impl — getSessionState (rehydration)', () => {
  it('maps the backend session state (status + model + pending permission)', async () => {
    const state = await svc.getSessionState('s1');
    expect(state.status).toBe('streaming');
    expect(state.modelId).toBe('claude-opus-4-6');
    expect(state.models).toEqual([
      { id: 'claude-opus-4-6', name: 'Opus' },
      { id: 'claude-haiku-4-5', name: 'Haiku' },
    ]);
    expect(state.pendingPermission?.options).toEqual([
      { id: 'opt-allow', label: 'Allow', kind: 'allow_once' },
    ]);
  });

  it('forwards setSessionModel to the binding', async () => {
    await svc.setSessionModel('s1', 'claude-haiku-4-5');
    expect(app.AgentSetSessionModel).toHaveBeenCalledWith(
      's1',
      'claude-haiku-4-5',
    );
  });
});
