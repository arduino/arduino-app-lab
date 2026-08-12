import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAssistantStore } from '../../store';
import { useAiAssistantPanelLogic } from './AiAssistantPanel.logic';

const services = vi.hoisted(() => ({
  getAuthStatus: vi.fn<[], Promise<unknown>>(),
  start: vi.fn<[string], Promise<void>>(),
  validateAuth: vi.fn<[], Promise<void>>(),
}));

vi.mock('../../services', () => ({
  getAuthStatus: services.getAuthStatus,
  start: services.start,
  validateAuth: services.validateAuth,
  onRestart: () => (): void => undefined,
  isAuthError: (): boolean => false,
  parseAgentError: (): { message: string } => ({ message: '' }),
}));

// The loader the panel shows over the chat is driven entirely by this hook, and it has no timeout —
// whatever leaves `loading` true keeps the user out of the chat until App Lab is restarted.
describe('useAiAssistantPanelLogic', () => {
  beforeEach(() => {
    services.getAuthStatus.mockReset().mockResolvedValue({
      authenticated: true,
      agentId: 'claude',
    });
    services.start.mockReset().mockResolvedValue(undefined);
    services.validateAuth.mockReset().mockResolvedValue(undefined);
    useAiAssistantStore.setState({
      auth: { authenticated: false },
      authResolved: false,
      lastValidatedAt: undefined,
      agentDown: false,
    });
  });

  // Signing in from Settings marks the credential fresh without this panel ever mounting, so the
  // first open takes the skip-the-probe path with authResolved still false — which used to hang.
  it('clears the loader on a first open that follows a sign-in made from Settings', async () => {
    useAiAssistantStore.setState({
      auth: { authenticated: true, agentId: 'claude' },
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

  // Past the freshness window the credential is re-probed, and an expired one has to reach the login
  // screen rather than the chat.
  it('re-validates a stale credential and drops to connect when the probe says signed out', async () => {
    services.getAuthStatus.mockResolvedValue({ authenticated: false });
    useAiAssistantStore.setState({
      auth: { authenticated: true, agentId: 'claude' },
      authResolved: false,
      lastValidatedAt: Date.now() - 3_600_000,
    });

    const { result } = renderHook(() => useAiAssistantPanelLogic());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authenticated).toBe(false);
  });
});
