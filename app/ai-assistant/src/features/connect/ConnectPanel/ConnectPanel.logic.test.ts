import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactElement, ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentDescriptor, AuthResult } from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { useAgentAuthFlow } from '../utils/useAgentAuthFlow';
import { useConnectPanelLogic } from './ConnectPanel.logic';

const agents = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'opencode', name: 'OpenCode', perProviderKeys: true },
] as AgentDescriptor[];

const services = vi.hoisted(() => ({
  install: vi.fn<(agentId: string) => Promise<void>>(),
  status: vi.fn<(agentId: string) => Promise<{ installed: boolean }>>(),
  cancelLogin: vi.fn<(agentId: string) => Promise<void>>(),
  authenticate: vi.fn<(agentId: string) => Promise<AuthResult>>(),
  authenticateApiKey:
    vi.fn<(agentId: string, key: string) => Promise<AuthResult>>(),
}));

vi.mock('../../../services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services')>()),
  listAgents: (): AgentDescriptor[] => agents,
  install: services.install,
  status: services.status,
  cancelLogin: services.cancelLogin,
  authenticate: services.authenticate,
  authenticateApiKey: services.authenticateApiKey,
  onLoginUrl: (): VoidFunction => (): void => undefined,
  onProgress: (): VoidFunction => (): void => undefined,
}));

// A promise the test settles by hand, to hold a call open.
const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('useConnectPanelLogic', () => {
  beforeEach(() => {
    services.install.mockReset().mockResolvedValue(undefined);
    services.status.mockReset().mockResolvedValue({ installed: false });
  });

  // A key added from the Connect panel has to be confirmed there too, checked or not.
  it('shows the notice the provider form sends', () => {
    const { result } = renderHook(() => useConnectPanelLogic());

    act(() => result.current.notify('OpenAI key checked and added.'));

    expect(result.current.notice).toBe('OpenAI key checked and added.');
    expect(result.current.toast).toBeUndefined();
  });
});

describe('useAgentAuthFlow', () => {
  // One flow serves every card, so a tab picked on one card must not open the next card it shows.
  it('opens the next agent on its own first tab, and cancels no login it did not start', () => {
    services.cancelLogin.mockReset().mockResolvedValue(undefined);
    const claude = {
      id: 'claude',
      authMethods: ['subscription', 'api_key'],
    } as AgentDescriptor;
    const opencode = {
      id: 'opencode',
      authMethods: ['api_key'],
    } as AgentDescriptor;
    const { result, rerender } = renderHook(
      ({ agent }) =>
        useAgentAuthFlow({
          agent,
          onAuthenticated: vi.fn(),
          place: 'Agent mode',
        }),
      { initialProps: { agent: opencode } },
    );
    expect(result.current.authTab).toBe('apikey');

    act(() => result.current.reset());
    rerender({ agent: claude });

    expect(result.current.authTab).toBe('signin');
    // Go cancels the agent's login wherever it runs, a sign-in waiting in the hidden Connect panel included.
    expect(services.cancelLogin).not.toHaveBeenCalled();
  });

  const claude = {
    id: 'claude',
    name: 'Claude Code',
    apiKeyPrefix: 'sk-ant-',
    authMethods: ['subscription', 'api_key'],
  } as AgentDescriptor;

  // Only a real provider fills the agent and the place into the refusal.
  const inIntl = {
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(IntlProvider, { locale: 'en' }, children),
  };

  beforeEach(() => {
    services.cancelLogin.mockReset().mockResolvedValue(undefined);
    services.authenticate.mockReset();
    services.authenticateApiKey.mockReset();
    useAiAssistantStore.setState({ agentSignIn: undefined });
  });

  // Each key check that passes restarts the agent, so a key is checked once while a check runs.
  it('checks a key once, however often Enter is pressed while it is checked', async () => {
    const check = deferred<AuthResult>();
    services.authenticateApiKey.mockReturnValue(check.promise);
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useAgentAuthFlow({ agent: claude, onAuthenticated, place: 'Settings' }),
    );
    act(() => result.current.setApiKey('sk-ant-test'));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.verifyApiKey();
      void result.current.verifyApiKey();
    });
    await act(async () => {
      check.resolve({ ok: true });
      await first;
    });

    expect(services.authenticateApiKey).toHaveBeenCalledTimes(1);
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  // Go runs one browser sign-in for the whole app: a second start would cancel the one waiting in the other surface.
  it('refuses a sign-in while the other surface waits for one, and names where', async () => {
    const login = deferred<AuthResult>();
    services.authenticate.mockReturnValueOnce(login.promise);
    const settingsError = vi.fn();
    const { result } = renderHook(
      () => ({
        connect: useAgentAuthFlow({
          agent: claude,
          onAuthenticated: vi.fn(),
          place: 'Agent mode',
        }),
        settings: useAgentAuthFlow({
          agent: claude,
          onAuthenticated: vi.fn(),
          onError: settingsError,
          place: 'Settings',
        }),
      }),
      inIntl,
    );

    let waiting: Promise<void> = Promise.resolve();
    act(() => {
      waiting = result.current.connect.signIn();
    });
    await act(() => result.current.settings.signIn());

    expect(services.authenticate).toHaveBeenCalledTimes(1);
    expect(settingsError).toHaveBeenCalledWith(
      'A sign-in to Claude Code is already waiting for confirmation in Agent mode. Finish it or cancel it there first.',
    );

    await act(async () => {
      login.resolve({ ok: false, error: 'the user closed the page' });
      await waiting;
    });
    services.authenticate.mockResolvedValueOnce({ ok: false });
    await act(() => result.current.settings.signIn());
    expect(services.authenticate).toHaveBeenCalledTimes(2);
  });

  it('refuses a sign-in to another agent while one waits, and names the agent that waits', async () => {
    services.authenticate.mockReturnValueOnce(deferred<AuthResult>().promise);
    const settingsError = vi.fn();
    const otherAgent = {
      id: 'opencode',
      name: 'OpenCode',
      authMethods: ['subscription'],
    } as AgentDescriptor;
    const { result } = renderHook(
      () => ({
        connect: useAgentAuthFlow({
          agent: claude,
          onAuthenticated: vi.fn(),
          place: 'Agent mode',
        }),
        settings: useAgentAuthFlow({
          agent: otherAgent,
          onAuthenticated: vi.fn(),
          onError: settingsError,
          place: 'Settings',
        }),
      }),
      inIntl,
    );

    act(() => {
      void result.current.connect.signIn();
    });
    await act(() => result.current.settings.signIn());

    expect(services.authenticate).toHaveBeenCalledTimes(1);
    expect(settingsError).toHaveBeenCalledWith(
      'A sign-in to Claude Code is already waiting for confirmation in Agent mode. Finish it or cancel it there first.',
    );
  });

  it('says the agent is restarting while the restart after a confirmed sign-in holds the slot', async () => {
    const restart = deferred<void>();
    services.authenticate.mockResolvedValueOnce({ ok: true });
    const settingsError = vi.fn();
    const { result } = renderHook(
      () => ({
        connect: useAgentAuthFlow({
          agent: claude,
          onAuthenticated: (): Promise<void> => restart.promise,
          place: 'Agent mode',
        }),
        settings: useAgentAuthFlow({
          agent: claude,
          onAuthenticated: vi.fn(),
          onError: settingsError,
          place: 'Settings',
        }),
      }),
      inIntl,
    );

    let signedIn: Promise<void> = Promise.resolve();
    act(() => {
      signedIn = result.current.connect.signIn();
    });
    await waitFor(() =>
      expect(useAiAssistantStore.getState().agentSignIn?.restarting).toBe(true),
    );
    await act(() => result.current.settings.signIn());

    expect(services.authenticate).toHaveBeenCalledTimes(1);
    expect(settingsError).toHaveBeenCalledWith(
      'Claude Code is restarting with the sign-in completed in Agent mode. Wait until it is back.',
    );

    await act(async () => {
      restart.resolve();
      await signedIn;
    });
    expect(useAiAssistantStore.getState().agentSignIn).toBeUndefined();
  });

  // A surface that closes cancels its own login and frees the slot, so the other surface is not refused.
  it('cancels its waiting login and frees the slot when its surface closes', () => {
    services.authenticate.mockReturnValueOnce(deferred<AuthResult>().promise);
    const { result, unmount } = renderHook(() =>
      useAgentAuthFlow({
        agent: claude,
        onAuthenticated: vi.fn(),
        place: 'Settings',
      }),
    );
    act(() => {
      void result.current.signIn();
    });
    expect(useAiAssistantStore.getState().agentSignIn?.place).toBe('Settings');

    unmount();

    expect(services.cancelLogin).toHaveBeenCalledWith('claude');
    expect(useAiAssistantStore.getState().agentSignIn).toBeUndefined();
  });
});
