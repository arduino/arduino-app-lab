import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentId, AuthStatus } from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { probeAgentAuth, resolveAgentAuth } from './resolveAgentAuth';

const service = vi.hoisted(() => ({
  listAgents: vi.fn<() => { id: string; comingSoon?: boolean }[]>(),
  getAuthStatus: vi.fn<(agentId: string) => Promise<AuthStatus>>(),
  currentAgent: vi.fn<() => Promise<string>>(),
}));

vi.mock('../../../services', () => ({
  listAgents: service.listAgents,
  getAuthStatus: service.getAuthStatus,
  currentAgent: service.currentAgent,
}));

const signedIn = (agentId: AgentId, isDefault = false): AuthStatus => ({
  authenticated: true,
  agentId,
  isDefault,
});

describe('resolveAgentAuth', () => {
  beforeEach(() => {
    service.listAgents
      .mockReset()
      .mockReturnValue([
        { id: 'claude' },
        { id: 'opencode' },
        { id: 'gemini', comingSoon: true },
      ]);
    service.getAuthStatus.mockReset();
    // The host's answer, which the probe reflects rather than deciding for itself.
    service.currentAgent.mockReset().mockResolvedValue('claude');
    useAiAssistantStore.setState({ selectedAgentId: undefined, auth: {} });
  });

  // Both can be signed in at once, and the Settings cards need every answer, not just the winner's.
  it('records every agent it could reach', async () => {
    service.getAuthStatus.mockImplementation((id) =>
      Promise.resolve(
        id === 'claude' ? signedIn('claude') : { authenticated: false },
      ),
    );

    await probeAgentAuth();

    expect(useAiAssistantStore.getState().auth).toEqual({
      claude: signedIn('claude'),
      opencode: { authenticated: false },
    });
  });

  // The host knows which process runs; deciding here showed Connect on every card from a Settings-first route.
  it('reflects the agent the host says is in use', async () => {
    service.getAuthStatus.mockResolvedValue(signedIn('claude', true));
    service.currentAgent.mockResolvedValue('opencode');

    await probeAgentAuth();

    expect(useAiAssistantStore.getState().selectedAgentId).toBe('opencode');
  });

  // A host that cannot answer must not blank the field: the previous answer beats no answer.
  it('keeps the agent already named when the host cannot answer', async () => {
    service.currentAgent.mockRejectedValue(new Error('no host'));
    service.getAuthStatus.mockResolvedValue(signedIn('claude'));
    useAiAssistantStore.getState().setSelectedAgent('opencode');

    await probeAgentAuth();

    expect(useAiAssistantStore.getState().selectedAgentId).toBe('opencode');
  });

  // Probe order is the order of a list, which is the thing the default setting exists to override.
  it('opens with the agent in use, not the first one to answer', async () => {
    service.currentAgent.mockResolvedValue('opencode');
    service.getAuthStatus.mockImplementation((id) =>
      Promise.resolve(signedIn(id as AgentId, id === 'claude')),
    );

    const chosen = await resolveAgentAuth();

    // Claude is the stored default; OpenCode is what is running, and running wins.
    expect(chosen).toEqual(signedIn('opencode'));
    expect(useAiAssistantStore.getState().selectedAgentId).toBe('opencode');
  });

  // With nothing running the host answers the default, which is what a fresh launch opens with.
  it('falls back to the default when that is what the host names', async () => {
    service.currentAgent.mockResolvedValue('claude');
    service.getAuthStatus.mockImplementation((id) =>
      Promise.resolve(signedIn(id as AgentId, id === 'claude')),
    );

    expect(await resolveAgentAuth()).toEqual(signedIn('claude', true));
  });

  // A keychain can be absent (headless Linux), and one rejection used to sink the whole bootstrap.
  it('still resolves when one agent cannot answer', async () => {
    service.getAuthStatus.mockImplementation((id) =>
      id === 'claude'
        ? Promise.reject(new Error('keychain locked'))
        : Promise.resolve(signedIn('opencode')),
    );

    const chosen = await resolveAgentAuth();

    expect(chosen).toEqual(signedIn('opencode'));
    expect(useAiAssistantStore.getState().selectedAgentId).toBe('opencode');
  });

  // The host still names one, but none is signed in, so the caller gets nothing: the connect screen.
  it('resolves no status when none is signed in', async () => {
    service.getAuthStatus.mockResolvedValue({ authenticated: false });

    expect(await resolveAgentAuth()).toBeUndefined();
  });
});
