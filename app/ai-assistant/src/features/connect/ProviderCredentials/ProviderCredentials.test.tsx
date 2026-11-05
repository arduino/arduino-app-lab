import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgentDescriptor,
  AgentProvider,
  ProviderCredential,
} from '../../../services';
import { ProviderCredentials } from './ProviderCredentials';

const services = vi.hoisted(() => ({
  listProviders: vi.fn<() => Promise<AgentProvider[]>>(),
  listProviderCredentials: vi.fn<() => Promise<ProviderCredential[]>>(),
  setProviderKey:
    vi.fn<() => Promise<{ ok: boolean; verified?: boolean; error?: string }>>(),
  deleteProviderKey: vi.fn<() => Promise<void>>(),
  signInProvider: vi.fn<() => Promise<{ ok: boolean }>>(),
}));

// Only the calls this surface makes; the rest of the barrel is loaded for real.
vi.mock('../../../services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services')>()),
  listProviders: services.listProviders,
  listProviderCredentials: services.listProviderCredentials,
  setProviderKey: services.setProviderKey,
  deleteProviderKey: services.deleteProviderKey,
  signInProvider: services.signInProvider,
  cancelProviderSignIn: vi.fn(),
  onProviderSignIn: (): VoidFunction => vi.fn(),
}));

const agent = {
  id: 'opencode',
  name: 'OpenCode',
  perProviderKeys: true,
} as AgentDescriptor;

const freeAgent = { ...agent, usableWithoutKey: true } as AgentDescriptor;

const anthropicKey: ProviderCredential = {
  providerId: 'anthropic',
  name: 'Anthropic',
  envVar: 'ANTHROPIC_API_KEY',
  maskedKey: 'sk-ant-••••1234',
};

const openai: AgentProvider = {
  id: 'openai',
  name: 'OpenAI',
  envVar: 'OPENAI_API_KEY',
};

// Add provider opens the list; picking OpenAI puts the key field on screen.
const chooseOpenAI = async (): Promise<void> => {
  fireEvent.click(await screen.findByText('Add provider'));
  fireEvent.click(await screen.findByText('OpenAI'));
};

const typeKey = (container: HTMLElement, key: string): HTMLInputElement => {
  const field = container.querySelector('input') as HTMLInputElement;
  fireEvent.change(field, { target: { value: key } });
  return field;
};

describe('ProviderCredentials', () => {
  beforeEach(() => {
    services.listProviders.mockReset().mockResolvedValue([openai]);
    services.listProviderCredentials.mockReset().mockResolvedValue([]);
    services.setProviderKey
      .mockReset()
      .mockResolvedValue({ ok: true, verified: true });
    services.deleteProviderKey.mockReset().mockResolvedValue(undefined);
    services.signInProvider.mockReset().mockResolvedValue({ ok: true });
  });

  // A key typed in the clear is readable over a shoulder, on a screen share and in a screenshot.
  it('masks the key as it is typed', async () => {
    const { container } = render(<ProviderCredentials agent={agent} />);
    await chooseOpenAI();

    const fields = container.querySelectorAll('input');
    expect(fields).toHaveLength(1);
    expect(fields[0].getAttribute('type')).toBe('password');
    // No toggle to reveal it either.
    expect(screen.queryByRole('button', { name: 'Show text' })).toBeNull();
  });

  // Unsaid, a key nobody could check reads as a checked one until the first message fails.
  it('says so when the host could not check the key', async () => {
    services.setProviderKey.mockResolvedValue({ ok: true, verified: false });
    const notify = vi.fn();
    const { container } = render(
      <ProviderCredentials agent={agent} onNotify={notify} />,
    );
    await chooseOpenAI();
    typeKey(container, 'sk-test-not-a-real-key');

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    const [message, kind] = notify.mock.calls[0];
    expect(message).toContain('could not be checked');
    expect(kind).toBe('success');
  });

  it('says a checked key was checked', async () => {
    const notify = vi.fn();
    const { container } = render(
      <ProviderCredentials agent={agent} onNotify={notify} />,
    );
    await chooseOpenAI();
    typeKey(container, 'sk-test-not-a-real-key');

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0][0]).toContain('checked and added');
  });

  // The Connect panel keeps a refused key next to the field it is about, and hears only what went in.
  it('keeps errors on its own line when asked to, and a later accepted key clears them', async () => {
    services.setProviderKey.mockResolvedValueOnce({
      ok: false,
      error: 'OpenAI rejected that API key',
    });
    const notify = vi.fn();
    const { container } = render(
      <ProviderCredentials agent={agent} onNotify={notify} inlineErrors />,
    );
    await chooseOpenAI();
    typeKey(container, 'sk-test-not-a-real-key');

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });
    expect(
      await screen.findByText('OpenAI rejected that API key'),
    ).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0][1]).toBe('success');
    expect(screen.queryByText('OpenAI rejected that API key')).toBeNull();
  });

  // Enter saves without going near the button, which is why disabling the button is not the barrier.
  it('saves the key on Enter in the field', async () => {
    const { container } = render(<ProviderCredentials agent={agent} />);
    await chooseOpenAI();
    const field = typeKey(container, 'sk-test-not-a-real-key');

    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });

    expect(services.setProviderKey).toHaveBeenCalledWith(
      'opencode',
      'openai',
      'sk-test-not-a-real-key',
    );
  });

  // Start building reads the keys when the agent starts, so a key still being checked would be missed.
  it('says it is busy while a key is being checked', async () => {
    let finish: (result: { ok: boolean; verified?: boolean }) => void = () =>
      undefined;
    services.setProviderKey.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onBusyChange = vi.fn();
    const { container } = render(
      <ProviderCredentials agent={agent} onBusyChange={onBusyChange} />,
    );
    await chooseOpenAI();
    typeKey(container, 'sk-test-not-a-real-key');
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      finish({ ok: true, verified: true });
    });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });

  // Every key change respawns the engine, which would kill the turn it is in the middle of.
  it('refuses to add or remove a key while a turn is running', async () => {
    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'anthropic',
        name: 'Anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        maskedKey: 'sk-…3f2a',
      },
    ]);
    render(
      <ProviderCredentials agent={agent} blockedReason="a turn is running" />,
    );

    const add = (await screen.findByText('Add provider')).closest(
      'button',
    ) as HTMLButtonElement;
    expect(add).toBeDisabled();
    // No intl provider here, so the accessible name is the message as authored.
    const remove = await screen.findByRole('button', {
      name: /^Remove (?!all$)/,
    });
    expect(remove).toBeDisabled();

    fireEvent.click(add);
    fireEvent.click(remove);

    expect(screen.queryByText('OpenAI')).toBeNull();
    expect(services.deleteProviderKey).not.toHaveBeenCalled();

    // A disabled control cannot say why on its own, so each blocked one carries the reason beside it.
    fireEvent.mouseEnter(add.closest('span') as HTMLElement);
    expect(await screen.findAllByText('a turn is running')).not.toHaveLength(0);
  });

  // A fixed placeholder: the free models are always there, so the row never has a remove button.
  it('always lists the free models, and never as removable', async () => {
    services.listProviderCredentials.mockResolvedValue([anthropicKey]);
    render(<ProviderCredentials agent={freeAgent} />);

    expect(await screen.findByText('{agent} free models')).toBeInTheDocument();
    expect(screen.getByText('No API key needed')).toBeInTheDocument();
    // Anthropic's alone: the free row has none.
    expect(
      await screen.findAllByRole('button', { name: /^Remove (?!all$)/ }),
    ).toHaveLength(1);
  });

  it('counts the connected providers', async () => {
    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'anthropic',
        name: 'Anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        maskedKey: 'sk-ant-••••1234',
      },
    ]);
    render(<ProviderCredentials agent={agent} />);

    // No intl provider here, so the message comes as authored.
    expect(await screen.findByText('{count} connected')).toBeInTheDocument();
    expect(screen.getByText('sk-ant-••••1234')).toBeInTheDocument();
  });

  // GitHub Copilot is connected with a GitHub account: a key field would ask for something that does not exist.
  it('starts the sign-in of a provider signed in to as soon as it is picked', async () => {
    services.listProviders.mockResolvedValue([
      openai,
      {
        id: 'github-copilot',
        name: 'GitHub Copilot',
        envVar: 'GITHUB_TOKEN',
        docUrl: 'https://docs.github.com/en/copilot',
        signIn: true,
      },
    ]);
    const { container } = render(<ProviderCredentials agent={agent} />);
    fireEvent.click(await screen.findByText('Add provider'));
    expect(screen.getByText('Sign in with {provider}')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('GitHub Copilot'));
    });

    expect(services.signInProvider).toHaveBeenCalledWith(
      'opencode',
      'github-copilot',
    );
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('labels a provider connected by signing in', async () => {
    services.listProviderCredentials.mockResolvedValue([
      {
        providerId: 'github-copilot',
        name: 'GitHub Copilot',
        envVar: 'GITHUB_TOKEN',
        maskedKey: '',
        signedIn: true,
      },
    ]);
    render(<ProviderCredentials agent={agent} />);

    expect(await screen.findByText('Signed in')).toBeInTheDocument();
  });

  // Students who will not pay: Google's free key is the way in, so the panel says so and links to it.
  it('points to the free key page of a provider that gives one', async () => {
    services.listProviders.mockResolvedValue([
      {
        id: 'google',
        name: 'Google Gemini',
        envVar: 'GOOGLE_API_KEY',
        docUrl: 'https://aistudio.google.com/apikey',
        freeKey: true,
        keySite: 'Google AI Studio',
      },
    ]);
    render(<ProviderCredentials agent={agent} />);

    fireEvent.click(await screen.findByText('Add provider'));
    expect(
      screen.getByText('API key · free models available'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Google Gemini'));

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
    expect(link).toHaveTextContent('Get a free key from {site}');
  });

  // Every key has to be fetched again from each provider's site, so one click must not be enough.
  it('asks before deleting every key', async () => {
    // The dialog measures itself, and jsdom has no layout engine.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    services.listProviderCredentials.mockResolvedValue([
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
    ]);
    render(<ProviderCredentials agent={agent} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove all' }));
    expect(
      await screen.findByText('Delete every key and sign-in?'),
    ).toBeInTheDocument();
    expect(services.deleteProviderKey).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole('button', { name: 'Remove all' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(services.deleteProviderKey).toHaveBeenCalledWith(
        'opencode',
        'openai',
      ),
    );
    vi.unstubAllGlobals();
  });

  it('goes back to the providers when the list is closed with nothing picked', async () => {
    render(<ProviderCredentials agent={agent} />);
    fireEvent.click(await screen.findByText('Add provider'));
    expect(screen.getByText('OpenAI')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(await screen.findByText('Add provider')).toBeInTheDocument();
  });

  // The form needs a way back that saves nothing, by pointer and by keyboard, and focus must not drop to the page.
  it('goes back on Cancel and on Escape with nothing saved, and focus returns to Add provider', async () => {
    const { container } = render(<ProviderCredentials agent={agent} />);
    fireEvent.click(await screen.findByText('Add provider'));
    // Closed from its trigger with nothing picked, the list ends adding, as a click outside does.
    fireEvent.click(screen.getByText('Provider').closest('button') as Element);
    expect(screen.queryByText('OpenAI')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.click(await screen.findByText('Add provider'));
    fireEvent.click(screen.getByText('OpenAI'));
    typeKey(container, 'sk-test-not-a-real-key');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const add = (await screen.findByText('Add provider')).closest('button');
    expect(add).toHaveFocus();

    await chooseOpenAI();
    fireEvent.keyDown(container.querySelector('input') as Element, {
      key: 'Escape',
    });

    expect(await screen.findByText('Add provider')).toBeInTheDocument();
    expect(services.setProviderKey).not.toHaveBeenCalled();
  });

  // The free models stay, so one key beside them is already more than one row to clear.
  it('offers Remove all with the free models and one key', async () => {
    services.listProviderCredentials.mockResolvedValue([anthropicKey]);
    render(<ProviderCredentials agent={freeAgent} />);

    expect(
      await screen.findByRole('button', { name: 'Remove all' }),
    ).toBeInTheDocument();
  });

  // The catalogue can take seconds, and a short list reads as all there is.
  it('says more providers are loading while the catalogue loads', async () => {
    services.listProviders.mockReturnValue(new Promise(() => undefined));
    render(<ProviderCredentials agent={freeAgent} />);

    fireEvent.click(await screen.findByText('Add provider'));

    expect(screen.getByText('Loading providers…')).toBeInTheDocument();
  });
});
