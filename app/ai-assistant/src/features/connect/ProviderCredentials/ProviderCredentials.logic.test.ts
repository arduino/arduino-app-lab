import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgentDescriptor,
  AgentProvider,
  ProviderCredential,
  ProviderSignInPrompt,
} from '../../../services';
import { useAiAssistantStore } from '../../../store';
import {
  type ProviderOutcome,
  useProviderCredentialsLogic,
} from './ProviderCredentials.logic';

const services = vi.hoisted(() => ({
  listProviders: vi.fn<() => Promise<AgentProvider[]>>(),
  listProviderCredentials: vi.fn<() => Promise<ProviderCredential[]>>(),
  setProviderKey:
    vi.fn<() => Promise<{ ok: boolean; verified?: boolean; error?: string }>>(),
  deleteProviderKey: vi.fn<() => Promise<void>>(),
  signInProvider: vi.fn<() => Promise<{ ok: boolean; error?: string }>>(),
  cancelProviderSignIn: vi.fn<() => Promise<void>>(),
}));
// The sign-in prompt arrives as an event, which is how a test hands the logic a code.
const signInHandlers = vi.hoisted(
  (): ((prompt: ProviderSignInPrompt) => void)[] => [],
);

vi.mock('../../../services', () => ({
  listProviders: services.listProviders,
  listProviderCredentials: services.listProviderCredentials,
  setProviderKey: services.setProviderKey,
  deleteProviderKey: services.deleteProviderKey,
  signInProvider: services.signInProvider,
  cancelProviderSignIn: services.cancelProviderSignIn,
  onProviderSignIn: (
    handler: (prompt: ProviderSignInPrompt) => void,
  ): VoidFunction => {
    signInHandlers.push(handler);
    return () => {
      signInHandlers.splice(signInHandlers.indexOf(handler), 1);
    };
  },
}));

const provider = (id: string, name: string): AgentProvider => ({
  id,
  name,
  envVar: `${id.toUpperCase()}_API_KEY`,
});

const agent = { id: 'opencode' } as AgentDescriptor;

describe('useProviderCredentialsLogic', () => {
  beforeEach(() => {
    services.listProviders
      .mockReset()
      .mockResolvedValue([
        provider('zzz', 'Zzz Labs'),
        provider('openai', 'OpenAI'),
        provider('anthropic', 'Anthropic'),
      ]);
    services.listProviderCredentials.mockReset().mockResolvedValue([]);
    services.setProviderKey
      .mockReset()
      .mockResolvedValue({ ok: true, verified: true });
    services.deleteProviderKey.mockReset().mockResolvedValue(undefined);
    services.signInProvider.mockReset().mockResolvedValue({ ok: true });
    services.cancelProviderSignIn.mockReset().mockResolvedValue(undefined);
    signInHandlers.length = 0;
    useAiAssistantStore.setState({ providerSignIn: undefined });
  });

  // A key typed for one provider must never reach another provider's servers with the next Verify.
  it('empties the key field when another provider is picked', async () => {
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(provider('zzz', 'Zzz Labs')));
    act(() => result.current.setApiKey('zzz-test-not-a-real-key'));
    act(() => result.current.select(provider('zzz', 'Zzz Labs')));
    expect(result.current.apiKey).toBe('zzz-test-not-a-real-key');

    act(() => result.current.select(provider('openai', 'OpenAI')));
    expect(result.current.apiKey).toBe('');
    await act(async () => {
      await result.current.save();
    });
    expect(services.setProviderKey).not.toHaveBeenCalled();
  });

  // A couple of hundred names nobody has memorised: a list that needs typing shows nothing.
  it('offers the providers before anything is typed', async () => {
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));

    await waitFor(() => expect(result.current.available.length).toBe(3));
    // The backend puts App Lab's own providers first; the list keeps its order.
    expect(result.current.available.map((p) => p.id)).toEqual([
      'zzz',
      'openai',
      'anthropic',
    ]);
  });

  it('closes the list once a key is added', async () => {
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.startAdding());
    expect(result.current.adding).toBe(true);
    expect(result.current.open).toBe(true);
    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('sk-test-not-a-real-key'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.adding).toBe(false);
  });

  // The engine writes its catalogue on install or first start, which can be after this panel mounted.
  it('fetches the catalogue again when it was empty', async () => {
    services.listProviders.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(result.current.catalogueEmpty).toBe(true));

    await act(async () => {
      result.current.startAdding();
    });

    await waitFor(() => expect(result.current.available.length).toBe(3));
    expect(services.listProviders).toHaveBeenCalledTimes(2);
  });

  // Several providers are configured at once, so one already added must not be offered again.
  it('drops the providers that already have a key', async () => {
    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'openai',
        name: 'OpenAI',
        envVar: 'OPENAI_API_KEY',
        maskedKey: '••••1234',
      },
    ]);
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));

    await waitFor(() => expect(result.current.configured.length).toBe(1));
    expect(result.current.available.map((p) => p.id)).not.toContain('openai');
  });

  // The engine reads keys at spawn: restarting only from the second left one provider unread.
  it('reports every key change, the first one included', async () => {
    const onFirst = vi.fn();
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, onFirst, onChanged),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'anthropic',
        name: 'Anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        maskedKey: '••••1234',
      },
    ]);
    act(() => result.current.select(provider('anthropic', 'Anthropic')));
    act(() => result.current.setApiKey('sk-ant-x'));
    await act(async () => {
      await result.current.save();
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
    // The first key is also what makes the agent usable, which is a different question.
    expect(onFirst).toHaveBeenCalledTimes(1);

    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'anthropic',
        name: 'Anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        maskedKey: '••••1234',
      },
      {
        providerId: 'openai',
        name: 'OpenAI',
        envVar: 'OPENAI_API_KEY',
        maskedKey: '••••5678',
      },
    ]);
    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('sk-y'));
    await act(async () => {
      await result.current.save();
    });
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(onFirst).toHaveBeenCalledTimes(1);
  });

  // A refused key is the provider's verdict: it must be shown, and nothing may be restarted for it.
  it('reports a refused key and leaves the engine alone', async () => {
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    services.setProviderKey.mockResolvedValue({
      ok: false,
      error: 'Anthropic rejected that API key',
    });
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(provider('anthropic', 'Anthropic')));
    act(() => result.current.setApiKey('sk-test-not-a-real-key'));
    await act(async () => {
      await result.current.save();
    });

    expect(outcomes).toEqual([
      {
        kind: 'error',
        provider: 'Anthropic',
        message: 'Anthropic rejected that API key',
      },
    ]);
    // A restart would respawn the engine for a key it never got.
    expect(onChanged).not.toHaveBeenCalled();
    // The typed key and the provider stay, or the user has to find and type both again.
    expect(result.current.selected?.id).toBe('anthropic');
    expect(result.current.apiKey).toBe('sk-test-not-a-real-key');
    expect(result.current.configured).toHaveLength(0);
    expect(result.current.saving).toBe(false);
  });

  // The call can fail before the provider is reached at all (the agent id, the keychain).
  it('reports a failure that is not the provider verdict', async () => {
    const outcomes: ProviderOutcome[] = [];
    services.setProviderKey.mockRejectedValue(new Error('keychain refused'));
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('sk-test-not-a-real-key'));
    await act(async () => {
      await result.current.save();
    });

    expect(outcomes).toEqual([
      { kind: 'error', provider: 'OpenAI', message: 'keychain refused' },
    ]);
    expect(result.current.saving).toBe(false);
  });

  // The host stores a key it could not check; saying nothing would read as "checked and added".
  it('passes on a key the provider never confirmed', async () => {
    services.setProviderKey.mockResolvedValue({ ok: true, verified: false });
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('sk-test-not-a-real-key'));
    await act(async () => {
      await result.current.save();
    });

    expect(outcomes).toEqual([
      { kind: 'added', provider: 'OpenAI', verified: false },
    ]);
  });

  // What the surface words: the provider's display name, never the id the engine keys it by.
  it('names the provider in the outcome of an add and a remove', async () => {
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'openai',
        name: 'OpenAI',
        envVar: 'OPENAI_API_KEY',
        maskedKey: '••••1234',
      },
    ]);
    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('sk-test-not-a-real-key'));
    await act(async () => {
      await result.current.save();
    });
    // verified comes from the host: a key nobody could check is worded differently by the surface.
    expect(outcomes).toEqual([
      { kind: 'added', provider: 'OpenAI', verified: true },
    ]);

    services.listProviderCredentials.mockResolvedValue([]);
    await act(async () => {
      await result.current.remove('openai');
    });
    expect(outcomes[1]).toEqual({ kind: 'removed', provider: 'OpenAI' });

    // One the list no longer holds: the id is the only name there is, and it beats saying nothing.
    await act(async () => {
      await result.current.remove('groq');
    });
    expect(outcomes[2]).toEqual({ kind: 'removed', provider: 'groq' });
  });

  // A pasted key carries the newline the console copied with it; untrimmed, every request fails.
  it('sends the key without the whitespace around it', async () => {
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('  sk-test-not-a-real-key\n'));
    await act(async () => {
      await result.current.save();
    });

    expect(services.setProviderKey).toHaveBeenCalledWith(
      'opencode',
      'openai',
      'sk-test-not-a-real-key',
    );
  });

  // Nothing to save is not an error to report: the button is reachable before both are given.
  it('saves nothing without a provider and a key', async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    await act(async () => {
      await result.current.save(); // no provider picked
    });
    act(() => result.current.select(provider('openai', 'OpenAI')));
    act(() => result.current.setApiKey('   '));
    await act(async () => {
      await result.current.save(); // a key of spaces
    });

    expect(services.setProviderKey).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(result.current.error).toBeUndefined();
  });

  // Before the engine's first run there is no catalogue, and an empty picker needs explaining.
  it('says when the engine has never fetched the list', async () => {
    services.listProviders.mockResolvedValue([]);
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalogueEmpty).toBe(true);
    expect(result.current.available).toHaveLength(0);
  });

  // In reverse too: the engine would keep offering a removed provider's models.
  it('reports a removal too', async () => {
    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'openai',
        name: 'OpenAI',
        envVar: 'OPENAI_API_KEY',
        maskedKey: '••••1234',
      },
    ]);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(1));

    services.listProviderCredentials.mockResolvedValue([]);
    await act(async () => {
      await result.current.remove('openai');
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  const twoKeys: ProviderCredential[] = [
    {
      providerId: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      maskedKey: '••••1234',
    },
    {
      providerId: 'anthropic',
      name: 'Anthropic',
      envVar: 'ANTHROPIC_API_KEY',
      maskedKey: '••••5678',
    },
  ];

  // Every change respawns the engine, so removing them all must restart it once, not once per key.
  it('removes every key with one engine restart', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    services.listProviderCredentials.mockResolvedValue([]);
    await act(async () => {
      await result.current.removeAll();
    });

    expect(services.deleteProviderKey.mock.calls).toEqual([
      ['opencode', 'openai'],
      ['opencode', 'anthropic'],
    ]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([{ kind: 'removedAll', provider: '' }]);
    expect(result.current.configured).toHaveLength(0);
  });

  // The keys that did go must still reach the engine, and the one that stayed must be named.
  it('names the provider whose key could not be removed', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    services.deleteProviderKey.mockImplementation(
      async (...args: unknown[]) => {
        if (args[1] === 'anthropic') {
          throw new Error('keychain refused');
        }
      },
    );
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    services.listProviderCredentials.mockResolvedValue([twoKeys[1]]);
    await act(async () => {
      await result.current.removeAll();
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([
      {
        kind: 'error',
        provider: 'Anthropic',
        message: 'Anthropic: keychain refused',
      },
    ]);
    expect(result.current.configured.map((c) => c.providerId)).toEqual([
      'anthropic',
    ]);
  });

  it('removes nothing while a turn blocks key changes', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged, undefined, true),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    await act(async () => {
      await result.current.removeAll();
    });

    expect(services.deleteProviderKey).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('runs one Delete all at a time', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    services.listProviderCredentials.mockResolvedValue([]);
    await act(async () => {
      await Promise.all([
        result.current.removeAll(),
        result.current.removeAll(),
      ]);
    });

    expect(services.deleteProviderKey).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('restarts nothing when no key could be removed', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    services.deleteProviderKey.mockRejectedValue(new Error('keychain refused'));
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    await act(async () => {
      await result.current.removeAll();
    });

    expect(onChanged).not.toHaveBeenCalled();
    expect(outcomes).toEqual([
      {
        kind: 'error',
        provider: 'OpenAI, Anthropic',
        message: 'OpenAI, Anthropic: keychain refused',
      },
    ]);
  });

  // The keys are gone either way: a list that fails to reload must not leave the engine offering them.
  it('restarts the engine even when the list does not reload', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, onChanged),
    );
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    services.listProviderCredentials.mockRejectedValue(
      new Error('store unreadable'),
    );
    await act(async () => {
      await result.current.removeAll();
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(result.current.configured).toHaveLength(0);
  });

  // Two writes to the provider index at once can lose one of them.
  it('ignores a key change while Delete all runs', async () => {
    services.listProviderCredentials.mockResolvedValue(twoKeys);
    let release: VoidFunction = () => undefined;
    services.deleteProviderKey.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(result.current.configured.length).toBe(2));

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.removeAll();
    });
    await act(async () => {
      await result.current.remove('openai');
    });
    expect(services.deleteProviderKey).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await running;
    });
    expect(services.deleteProviderKey).toHaveBeenCalledTimes(2);
  });

  const copilot: AgentProvider = {
    ...provider('github-copilot', 'GitHub Copilot'),
    signIn: true,
  };
  const deviceLogin: ProviderSignInPrompt = {
    providerId: 'github-copilot',
    url: 'https://github.com/login/device',
    code: '1A2B-C3D4',
  };

  // The code goes on screen and the page opens by itself; the provider is listed once the engine holds the login.
  it('signs in to a provider that takes no key', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    let finish: (result: { ok: boolean }) => void = () => undefined;
    services.signInProvider.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onFirst = vi.fn();
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, onFirst, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));

    act(() => result.current.select(copilot));
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.signIn();
    });
    expect(result.current.signingIn).toBe(true);
    act(() => {
      signInHandlers.forEach((handler) => handler(deviceLogin));
    });
    expect(result.current.signInPrompt).toEqual({
      url: 'https://github.com/login/device',
      code: '1A2B-C3D4',
    });
    expect(opened).toHaveBeenCalledWith(
      'https://github.com/login/device',
      '_blank',
      'noopener,noreferrer',
    );

    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'github-copilot',
        name: 'GitHub Copilot',
        envVar: 'GITHUB_TOKEN',
        maskedKey: '',
        signedIn: true,
      },
    ]);
    await act(async () => {
      finish({ ok: true });
      await running;
    });

    expect(services.signInProvider).toHaveBeenCalledWith(
      'opencode',
      'github-copilot',
    );
    expect(result.current.configured.map((c) => c.providerId)).toEqual([
      'github-copilot',
    ]);
    expect(outcomes).toEqual([
      { kind: 'signedIn', provider: 'GitHub Copilot' },
    ]);
    // A new login needs a restart to be seen, like a new key; being the first, it also connects the agent.
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(result.current.signingIn).toBe(false);
    expect(result.current.signInPrompt).toBeUndefined();
    expect(signInHandlers).toHaveLength(0);
    opened.mockRestore();
  });

  // Cancelling ends the engine's login with an error the user who cancelled does not need to read.
  it('says nothing about a sign-in the user cancelled', async () => {
    let finish: (result: { ok: boolean; error?: string }) => void = () =>
      undefined;
    services.signInProvider.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.select(copilot));
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.signIn();
    });

    act(() => result.current.cancelSignIn());
    await act(async () => {
      finish({ ok: false, error: 'context canceled' });
      await running;
    });

    expect(services.cancelProviderSignIn).toHaveBeenCalledWith('opencode');
    expect(outcomes).toEqual([]);
    expect(result.current.signingIn).toBe(false);
  });

  it('reports a sign-in that did not finish', async () => {
    services.signInProvider.mockResolvedValue({
      ok: false,
      error: 'the sign-in did not finish; start it again',
    });
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.select(copilot));

    await act(async () => {
      await result.current.signIn();
    });

    expect(outcomes).toEqual([
      {
        kind: 'error',
        provider: 'GitHub Copilot',
        message: 'the sign-in did not finish; start it again',
      },
    ]);
    expect(result.current.configured).toHaveLength(0);
  });

  it('starts no sign-in while a turn blocks key changes', async () => {
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, undefined, true),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.select(copilot));

    await act(async () => {
      await result.current.signIn();
    });

    expect(services.signInProvider).not.toHaveBeenCalled();
  });

  // A login left running after the panel closes would restart the engine when it finishes, maybe mid-turn.
  it('cancels a sign-in when the panel closes', async () => {
    services.signInProvider.mockReturnValue(new Promise(() => undefined));
    const { result, unmount } = renderHook(() =>
      useProviderCredentialsLogic(agent),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.select(copilot));
    act(() => {
      void result.current.signIn();
    });
    expect(result.current.signingIn).toBe(true);

    unmount();

    expect(services.cancelProviderSignIn).toHaveBeenCalledWith('opencode');
  });

  const copilotSignedIn: ProviderCredential = {
    providerId: 'github-copilot',
    name: 'GitHub Copilot',
    envVar: 'GITHUB_TOKEN',
    maskedKey: '',
    signedIn: true,
  };

  // The Connect panel and Settings each mount a form, and Go cancels the first login when a second one starts.
  it('refuses a sign-in while another form waits on one, and names where', async () => {
    services.signInProvider.mockReturnValue(new Promise(() => undefined));
    const outcomes: ProviderOutcome[] = [];
    const first = renderHook(() =>
      useProviderCredentialsLogic(
        agent,
        undefined,
        undefined,
        undefined,
        false,
        'Agent mode',
      ),
    );
    const second = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, (o) =>
        outcomes.push(o),
      ),
    );
    // A form with no host to report to keeps the refusal for its own line.
    const third = renderHook(() => useProviderCredentialsLogic(agent));
    await waitFor(() => expect(second.result.current.available.length).toBe(3));
    act(() => first.result.current.select(copilot));
    act(() => {
      void first.result.current.signIn();
    });

    act(() => second.result.current.select(copilot));
    await act(async () => {
      await second.result.current.signIn();
    });
    act(() => third.result.current.select(copilot));
    await act(async () => {
      await third.result.current.signIn();
    });

    expect(services.signInProvider).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([
      { kind: 'signInBusy', provider: 'GitHub Copilot', place: 'Agent mode' },
    ]);
    expect(second.result.current.signingIn).toBe(false);
    expect(third.result.current.refusedSignIn).toEqual({
      provider: 'GitHub Copilot',
      place: 'Agent mode',
    });

    // Once the waiting sign-in is over, the line would name one that no longer exists.
    act(() => first.unmount());
    await waitFor(() =>
      expect(third.result.current.refusedSignIn).toBeUndefined(),
    );
  });

  // Else the other form keeps offering a sign-in to a provider that is already signed in.
  it("reads the providers again when another form's sign-in ends", async () => {
    let finish: (result: { ok: boolean }) => void = () => undefined;
    services.signInProvider.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = renderHook(() => useProviderCredentialsLogic(agent));
    const second = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, () => undefined),
    );
    await waitFor(() => expect(second.result.current.available.length).toBe(3));
    act(() => first.result.current.select(copilot));
    act(() => {
      void first.result.current.signIn();
    });
    act(() => second.result.current.startAdding());
    act(() => second.result.current.select(copilot));
    await act(async () => {
      await second.result.current.signIn();
    });

    services.listProviderCredentials.mockResolvedValue([copilotSignedIn]);
    await act(async () => {
      finish({ ok: true });
    });

    await waitFor(() =>
      expect(second.result.current.configured).toEqual([copilotSignedIn]),
    );
    expect(second.result.current.adding).toBe(false);
    expect(second.result.current.selected).toBeUndefined();
  });

  // A provider that is signed in is one, whatever the call said: the engine needs the restart, the user the news.
  it('treats a sign-in that errored but landed as one that succeeded', async () => {
    services.signInProvider.mockResolvedValue({
      ok: false,
      error: 'context canceled',
    });
    const onFirst = vi.fn();
    const onChanged = vi.fn();
    const outcomes: ProviderOutcome[] = [];
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, onFirst, onChanged, (o) =>
        outcomes.push(o),
      ),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.startAdding());
    act(() => result.current.select(copilot));

    services.listProviderCredentials.mockResolvedValue([copilotSignedIn]);
    await act(async () => {
      await result.current.signIn();
    });

    expect(outcomes).toEqual([
      { kind: 'signedIn', provider: 'GitHub Copilot' },
    ]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(result.current.configured).toEqual([copilotSignedIn]);
    expect(result.current.adding).toBe(false);
  });

  // The plan hint names one cause: next to a timeout or an unfinished sign-in it reads as the reason for them.
  it('blames the account only for a failure after the provider showed its code', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    services.signInProvider.mockResolvedValueOnce({
      ok: false,
      error: 'the sign-in showed no code',
    });
    const { result } = renderHook(() =>
      useProviderCredentialsLogic(agent, undefined, undefined, () => undefined),
    );
    await waitFor(() => expect(result.current.available.length).toBe(3));
    act(() => result.current.select(copilot));
    await act(async () => {
      await result.current.signIn();
    });
    expect(result.current.signInRefused).toBe(false);

    // After the code: only the CLI's own failure line is the provider turning the account down.
    const failAfterCode = async (error: string): Promise<void> => {
      let finish: (result: { ok: boolean; error?: string }) => void = () =>
        undefined;
      services.signInProvider.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      let running: Promise<void> = Promise.resolve();
      act(() => {
        running = result.current.signIn();
      });
      act(() => {
        signInHandlers.forEach((handler) => handler(deviceLogin));
      });
      await act(async () => {
        finish({ ok: false, error });
        await running;
      });
    };

    await failAfterCode('the sign-in did not finish; start it again');
    expect(result.current.signInRefused).toBe(false);

    await failAfterCode('Error: failed to authorize');
    expect(result.current.signInRefused).toBe(true);
    opened.mockRestore();
  });
});
