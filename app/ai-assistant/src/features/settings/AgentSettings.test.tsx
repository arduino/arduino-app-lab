import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentDescriptor,
  AgentId,
  AuthStatus,
  RuntimeStatus,
} from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { AgentSettings } from './AgentSettings';

// jsdom has no ResizeObserver; the uninstall dialog's Scrollable needs one.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

const agents: AgentDescriptor[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Use your Claude Pro/Max account or an Anthropic API key',
    provider: 'Anthropic',
    authMethods: ['subscription', 'api_key'],
    apiKeyPrefix: 'sk-ant-',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent',
    provider: 'OpenCode',
    authMethods: ['api_key'],
    perProviderKeys: true,
    usableWithoutKey: true,
    apiKeyPrefix: '',
  },
];

const services = vi.hoisted(() => ({
  getAuthStatus: vi.fn<(agentId: string) => Promise<unknown>>(),
  currentAgent: vi.fn<() => Promise<string>>(),
  status: vi.fn<(agentId: string) => Promise<unknown>>(),
  switchAgent: vi.fn<(agentId: string) => Promise<void>>(),
  start: vi.fn<(agentId: string) => Promise<void>>(),
  stop: vi.fn<() => Promise<void>>(),
  setDefaultAgent: vi.fn<(agentId: string) => Promise<void>>(),
  disconnect: vi.fn<(agentId: string) => Promise<void>>(),
  connectWithoutKey: vi.fn<(agentId: string) => Promise<void>>(),
  install: vi.fn<(agentId: string) => Promise<void>>(),
  uninstall: vi.fn<(agentId: string) => Promise<void>>(),
  listProviders: vi.fn<() => Promise<unknown[]>>(),
  listProviderCredentials: vi.fn<() => Promise<unknown[]>>(),
  setProviderKey:
    vi.fn<() => Promise<{ ok: boolean; verified?: boolean; error?: string }>>(),
}));

// getAgent goes with the list: the real one reads the real list, which throws outside a Wails host.
vi.mock('../../services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services')>()),
  listAgents: (): AgentDescriptor[] => agents.map((a) => ({ ...a })),
  getAgent: (id?: AgentId): AgentDescriptor | undefined =>
    agents.find((a) => a.id === id),
  getAuthStatus: services.getAuthStatus,
  currentAgent: services.currentAgent,
  status: services.status,
  onProgress: (): VoidFunction => (): void => undefined,
  switchAgent: services.switchAgent,
  start: services.start,
  stop: services.stop,
  setDefaultAgent: services.setDefaultAgent,
  disconnect: services.disconnect,
  connectWithoutKey: services.connectWithoutKey,
  install: services.install,
  uninstall: services.uninstall,
  listProviders: services.listProviders,
  listProviderCredentials: services.listProviderCredentials,
  setProviderKey: services.setProviderKey,
}));

const connected = (agentId: AgentId, account: string): AuthStatus => ({
  authenticated: true,
  agentId,
  method: 'api_key',
  account,
  connectedAt: '2026-06-02T10:00:00Z',
});

// The card of one agent, so an assertion cannot pass on the other one's markup.
const card = async (name: string): Promise<HTMLElement> => {
  const heading = await screen.findByText(name);
  const li = heading.closest('li');
  if (!li) {
    throw new Error(`no card for ${name}`);
  }
  return li;
};

// A button with an icon renders its label twice, so the match lands on the button, not a text node.
const action = (scope: HTMLElement, label: string): HTMLButtonElement | null =>
  within(scope).queryAllByText(label)[0]?.closest('button') ?? null;

describe('AgentSettings', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useAiAssistantStore.setState({
      auth: {},
      selectedAgentId: undefined,
      runtimeInstalled: {},
      credentialRestart: undefined,
    });
    // Both agents hold a credential; only one is the agent in use.
    services.getAuthStatus
      .mockReset()
      .mockImplementation(async (agentId: string) =>
        agentId === 'claude'
          ? connected('claude', 'user@arduino.cc')
          : connected('opencode', 'sk-…3f2a'),
      );
    services.currentAgent.mockReset().mockResolvedValue('claude');
    services.status.mockReset().mockResolvedValue({
      installed: true,
      version: 'v18.20.4',
    } as RuntimeStatus);
    services.switchAgent.mockReset().mockResolvedValue(undefined);
    services.start.mockReset().mockResolvedValue(undefined);
    services.stop.mockReset().mockResolvedValue(undefined);
    services.setDefaultAgent.mockReset().mockResolvedValue(undefined);
    services.disconnect.mockReset().mockResolvedValue(undefined);
    services.connectWithoutKey.mockReset().mockResolvedValue(undefined);
    services.install.mockReset().mockResolvedValue(undefined);
    services.uninstall.mockReset().mockResolvedValue(undefined);
    services.listProviders.mockReset().mockResolvedValue([]);
    services.listProviderCredentials.mockReset().mockResolvedValue([]);
    services.setProviderKey
      .mockReset()
      .mockResolvedValue({ ok: true, verified: true });
  });

  // A key check that ends during a turn must not restart the agent under it: it waits for the turn, and says so.
  it('holds the restart for a new key until the turn ends, and says why', async () => {
    services.currentAgent.mockResolvedValue('opencode');
    services.listProviders.mockResolvedValue([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
    ]);
    let finishCheck: (result: {
      ok: boolean;
      verified: boolean;
    }) => void = () => undefined;
    services.setProviderKey.mockReturnValue(
      new Promise((resolve) => {
        finishCheck = resolve;
      }),
    );
    render(<AgentSettings />);
    const inUse = await card('OpenCode');
    await waitFor(() => expect(action(inUse, 'Manage')).toBeInTheDocument());
    fireEvent.click(action(inUse, 'Manage') as HTMLButtonElement);
    fireEvent.click(await within(inUse).findByText('Add provider'));
    fireEvent.click(within(inUse).getByText('OpenAI'));
    fireEvent.change(inUse.querySelector('input') as Element, {
      target: { value: 'sk-test-not-a-real-key' },
    });
    fireEvent.click(within(inUse).getByText('Verify'));

    act(() => {
      useChatStore.getState().beginTurn('sess-blink');
    });
    await act(async () => {
      finishCheck({ ok: true, verified: true });
    });

    // No intl provider here, so the message comes as authored.
    expect(
      await screen.findByText(
        '{agent} is answering. It will restart with your change when the turn ends.',
      ),
    ).toBeInTheDocument();
    expect(services.switchAgent).not.toHaveBeenCalled();

    act(() => {
      useChatStore.getState().endTurn('sess-blink');
    });
    await waitFor(() =>
      expect(services.start).toHaveBeenCalledWith('opencode'),
    );
    expect(
      screen.queryByText(
        '{agent} is answering. It will restart with your change when the turn ends.',
      ),
    ).not.toBeInTheDocument();
  });

  // A key stored while the agent restarts could land after the new process has read its keys.
  it('blocks the keys of the agent in use while it restarts', async () => {
    services.currentAgent.mockResolvedValue('opencode');
    render(<AgentSettings />);
    const inUse = await card('OpenCode');
    await waitFor(() => expect(action(inUse, 'Manage')).toBeInTheDocument());
    fireEvent.click(action(inUse, 'Manage') as HTMLButtonElement);
    await waitFor(() => expect(action(inUse, 'Add provider')).toBeEnabled());

    act(() => {
      useAiAssistantStore.setState({
        credentialRestart: { agentId: 'opencode', phase: 'restarting' },
      });
    });
    expect(action(inUse, 'Add provider')).toBeDisabled();

    act(() => {
      useAiAssistantStore.setState({ credentialRestart: undefined });
    });
    expect(action(inUse, 'Add provider')).toBeEnabled();
  });

  // Two agents can hold a credential; read apart, one card said Connected and Connect at once.
  it('shows the connection on the agent in use and nowhere else', async () => {
    render(<AgentSettings />);

    const inUse = await card('Claude Code');
    await waitFor(() =>
      expect(within(inUse).queryByText('Connected')).toBeInTheDocument(),
    );
    expect(action(inUse, 'Manage')).toBeInTheDocument();
    expect(action(inUse, 'Connect')).toBeNull();
    // Its subtitle is the connection, not the description it carries when it is not in use.
    expect(
      within(inUse).queryByText(
        'Use your Claude Pro/Max account or an Anthropic API key',
      ),
    ).not.toBeInTheDocument();

    // The other agent needs no credential: there is nothing to connect, so it opens straight to Manage.
    const other = await card('OpenCode');
    expect(within(other).queryByText('Connected')).not.toBeInTheDocument();
    expect(action(other, 'Manage')).toBeInTheDocument();
    expect(action(other, 'Connect')).toBeNull();
    expect(within(other).queryByText('sk-…3f2a')).not.toBeInTheDocument();
    // Its own description stays as the subtitle: the message kept for its agent id, over the descriptor's text.
    expect(
      within(other).getByText(
        'Open-source coding Agent · use it with OpenCode or Gemini',
      ),
    ).toBeInTheDocument();
    expect(
      within(other).queryByText('Open-source coding agent'),
    ).not.toBeInTheDocument();
  });

  // Connect is gone: Manage on an agent not connected opens its sign-in with its runtime, and closes it again.
  it('opens the sign-in and the runtime from Manage on an agent not connected', async () => {
    services.currentAgent.mockResolvedValue('opencode');
    services.getAuthStatus.mockImplementation(async (agentId: string) =>
      agentId === 'opencode'
        ? { authenticated: true, agentId: 'opencode' }
        : { authenticated: false, agentId: 'claude' },
    );
    render(<AgentSettings />);
    const claude = await card('Claude Code');
    await waitFor(() => expect(action(claude, 'Manage')).toBeEnabled());
    expect(action(claude, 'Connect')).toBeNull();

    fireEvent.click(action(claude, 'Manage') as HTMLButtonElement);

    expect(
      await within(claude).findByText('Runtime & Packages'),
    ).toBeInTheDocument();
    expect(within(claude).getAllByRole('tab').length).toBeGreaterThan(0);
    expect(action(claude, 'Cancel')).toBeNull();

    fireEvent.click(action(claude, 'Manage') as HTMLButtonElement);
    await waitFor(() =>
      expect(within(claude).queryByText('Runtime & Packages')).toBeNull(),
    );
  });

  // Manage opens the details of the agent in use; the same value decides whether there is a body.
  it('opens the account details of the agent in use', async () => {
    render(<AgentSettings />);
    const inUse = await card('Claude Code');
    // Manage is there before the status is read, where it opens the sign-in: wait for the account.
    expect(await within(inUse).findByText('Connected')).toBeInTheDocument();

    fireEvent.click(action(inUse, 'Manage') as HTMLButtonElement);

    expect(within(inUse).getByText('Account / Key')).toBeInTheDocument();
    expect(within(inUse).getByText('user@arduino.cc')).toBeInTheDocument();
  });

  // Connect respawns the agent, which would kill the turn it is in the middle of answering.
  it('refuses to switch to another agent while a turn is running', async () => {
    render(<AgentSettings />);
    const other = await card('OpenCode');
    await waitFor(() => expect(action(other, 'Manage')).toBeInTheDocument());
    fireEvent.click(action(other, 'Manage') as HTMLButtonElement);
    await waitFor(() =>
      expect(action(other, 'Set as default')).toBeInTheDocument(),
    );
    // Its keys are listed per provider; there is no one account to show.
    expect(within(other).queryByText('Account / Key')).not.toBeInTheDocument();

    act(() => {
      useChatStore.getState().beginTurn('sess-blink');
    });
    expect(action(other, 'Set as default')).toBeDisabled();
    // A key change restarts only the agent in use, so that agent's turn leaves this one's keys free.
    expect(action(other, 'Add provider')).toBeEnabled();

    fireEvent.click(action(other, 'Set as default') as HTMLButtonElement);
    expect(services.switchAgent).not.toHaveBeenCalled();
    expect(services.setDefaultAgent).not.toHaveBeenCalled();

    // The barrier lifts when the turn ends; the agent-gone route has its own test below.
    act(() => {
      useChatStore.getState().endTurn('sess-blink');
    });
    await waitFor(() => expect(action(other, 'Set as default')).toBeEnabled());
  });

  // Disconnect and Uninstall stop the agent too, so the barrier is not only on the Connect button.
  it('refuses every action on the card in use while a turn is running', async () => {
    render(<AgentSettings />);
    const inUse = await card('Claude Code');
    // Manage is there before the status is read, where it opens the sign-in: wait for the account.
    expect(await within(inUse).findByText('Connected')).toBeInTheDocument();
    fireEvent.click(action(inUse, 'Manage') as HTMLButtonElement);
    fireEvent.click(
      within(inUse)
        .getByText('Runtime & Packages')
        .closest('button') as HTMLButtonElement,
    );
    expect(action(inUse, 'Uninstall')).toBeEnabled();

    act(() => {
      useChatStore.getState().beginTurn('sess-blink');
    });

    expect(action(inUse, 'Disconnect')).toBeDisabled();
    expect(action(inUse, 'Uninstall')).toBeDisabled();
    fireEvent.click(action(inUse, 'Disconnect') as HTMLButtonElement);
    expect(screen.queryByText('Disconnect Provider')).not.toBeInTheDocument();
    expect(services.disconnect).not.toHaveBeenCalled();
  });

  // A crash resets the chat instead of ending the turn; the barrier must lift there too.
  it('lifts the barrier when the agent goes mid-turn', async () => {
    render(<AgentSettings />);
    const other = await card('OpenCode');
    await waitFor(() => expect(action(other, 'Manage')).toBeInTheDocument());
    fireEvent.click(action(other, 'Manage') as HTMLButtonElement);
    await waitFor(() =>
      expect(action(other, 'Set as default')).toBeInTheDocument(),
    );

    act(() => {
      useChatStore.getState().beginTurn('sess-blink');
    });
    expect(action(other, 'Set as default')).toBeDisabled();

    act(() => {
      useChatStore.getState().resetLoadedSessions();
    });
    await waitFor(() => expect(action(other, 'Set as default')).toBeEnabled());
  });

  // Free models need no sign-in: once installed it is connected, and the agent in use stays in use.
  it('offers Manage on a free agent right after its install', async () => {
    let installed = false;
    services.status.mockImplementation(async (agentId: string) => ({
      installed: agentId === 'claude' || installed,
      version: 'v18.20.4',
    }));
    services.install.mockImplementation(async () => {
      installed = true;
    });
    services.getAuthStatus.mockImplementation(async (agentId: string) =>
      agentId === 'claude'
        ? connected('claude', 'user@arduino.cc')
        : services.connectWithoutKey.mock.calls.length > 0
        ? { authenticated: true, agentId: 'opencode' }
        : { authenticated: false, agentId: 'opencode' },
    );
    render(<AgentSettings />);
    const inUse = await card('Claude Code');
    await waitFor(() =>
      expect(within(inUse).queryByText('Connected')).toBeInTheDocument(),
    );
    const other = await card('OpenCode');
    await waitFor(() => expect(action(other, 'Install')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(action(other, 'Install') as HTMLButtonElement);
    });

    await waitFor(() => expect(action(other, 'Manage')).toBeInTheDocument());
    expect(action(other, 'Connect')).toBeNull();
    expect(services.connectWithoutKey).toHaveBeenCalledWith('opencode');
    expect(services.switchAgent).not.toHaveBeenCalled();
    expect(screen.queryByText('Switch agent?')).not.toBeInTheDocument();
  });

  // The card opens on its providers with the list closed, so the free models row shows they need nothing.
  it.each([
    ['beside the agent in use', true],
    ['as the first agent', false],
  ])(
    'opens a free agent on its providers right after its install, %s',
    async (_, claudeInUse) => {
      let installed = false;
      services.status.mockImplementation(async (agentId: string) => ({
        installed: (claudeInUse && agentId === 'claude') || installed,
        version: 'v18.20.4',
      }));
      services.install.mockImplementation(async () => {
        installed = true;
      });
      services.currentAgent.mockResolvedValue(
        claudeInUse ? 'claude' : 'opencode',
      );
      services.getAuthStatus.mockImplementation(async (agentId: string) =>
        agentId === 'claude'
          ? claudeInUse
            ? connected('claude', 'user@arduino.cc')
            : { authenticated: false, agentId: 'claude' }
          : services.connectWithoutKey.mock.calls.length > 0
          ? { authenticated: true, agentId: 'opencode' }
          : { authenticated: false, agentId: 'opencode' },
      );
      services.listProviders.mockResolvedValue([
        { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
      ]);
      render(<AgentSettings />);
      const other = await card('OpenCode');
      await waitFor(() => expect(action(other, 'Install')).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(action(other, 'Install') as HTMLButtonElement);
      });

      expect(
        await within(other).findByText('No API key needed'),
      ).toBeInTheDocument();
      expect(action(other, 'Add provider')).toBeInTheDocument();
      expect(within(other).queryByText('OpenAI')).toBeNull();
    },
  );

  // The step after an install from Settings: Set as default that also opens Agent mode, once the switch is done.
  describe('Start building', () => {
    // Claude Code in use and connected; OpenCode installed from the card, then connected without a key.
    const installOpenCode = async (
      onStartBuilding: VoidFunction,
    ): Promise<HTMLElement> => {
      let installed = false;
      services.status.mockImplementation(async (agentId: string) => ({
        installed: agentId === 'claude' || installed,
        version: 'v18.20.4',
      }));
      services.install.mockImplementation(async () => {
        installed = true;
      });
      services.getAuthStatus.mockImplementation(async (agentId: string) =>
        agentId === 'claude'
          ? connected('claude', 'user@arduino.cc')
          : services.connectWithoutKey.mock.calls.length > 0
          ? { authenticated: true, agentId: 'opencode' }
          : { authenticated: false, agentId: 'opencode' },
      );
      render(<AgentSettings onStartBuilding={onStartBuilding} />);
      const other = await card('OpenCode');
      await waitFor(() => expect(action(other, 'Install')).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(action(other, 'Install') as HTMLButtonElement);
      });
      await waitFor(() =>
        expect(action(other, 'Start building')).toBeInTheDocument(),
      );
      return other;
    };

    it('replaces Set as default right after the install, and switches without asking before it opens Agent mode', async () => {
      const onStartBuilding = vi.fn();
      const other = await installOpenCode(onStartBuilding);
      expect(action(other, 'Set as default')).toBeNull();

      fireEvent.click(action(other, 'Start building') as HTMLButtonElement);

      await waitFor(() => expect(onStartBuilding).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(services.switchAgent).toHaveBeenCalledWith('opencode');
    });

    it('is still offered when the installed card is closed and opened again', async () => {
      const other = await installOpenCode(vi.fn());

      fireEvent.click(action(other, 'Manage') as HTMLButtonElement);
      fireEvent.click(action(other, 'Manage') as HTMLButtonElement);

      expect(
        await within(other).findByText('Add provider'),
      ).toBeInTheDocument();
      expect(action(other, 'Start building')).toBeInTheDocument();
    });

    // Set as default on another agent is behind its Manage, and opening that ends the install's step.
    it('gives way to Set as default once another card is opened', async () => {
      const other = await installOpenCode(vi.fn());
      const claude = await card('Claude Code');

      fireEvent.click(action(claude, 'Manage') as HTMLButtonElement);
      fireEvent.click(action(other, 'Manage') as HTMLButtonElement);

      expect(
        await within(other).findByText('Add provider'),
      ).toBeInTheDocument();
      expect(action(other, 'Start building')).toBeNull();
      expect(action(other, 'Set as default')).toBeInTheDocument();
    });

    it('is not offered on a free agent that was not just installed', async () => {
      services.getAuthStatus.mockImplementation(async (agentId: string) =>
        agentId === 'claude'
          ? connected('claude', 'user@arduino.cc')
          : { authenticated: true, agentId: 'opencode' },
      );
      render(<AgentSettings onStartBuilding={vi.fn()} />);
      const other = await card('OpenCode');
      await waitFor(() => expect(action(other, 'Manage')).toBeInTheDocument());
      fireEvent.click(action(other, 'Manage') as HTMLButtonElement);

      expect(
        await within(other).findByText('Add provider'),
      ).toBeInTheDocument();
      expect(action(other, 'Start building')).toBeNull();
      expect(action(other, 'Set as default')).toBeInTheDocument();
    });
  });

  it('closes the sign-in when the agent is uninstalled from it', async () => {
    services.getAuthStatus.mockImplementation(async (agentId: string) =>
      agentId === 'opencode'
        ? connected('opencode', 'sk-…3f2a')
        : { authenticated: false, agentId: 'claude' },
    );
    services.currentAgent.mockResolvedValue('opencode');
    render(<AgentSettings />);
    const other = await card('Claude Code');
    await waitFor(() => expect(action(other, 'Manage')).toBeEnabled());
    fireEvent.click(action(other, 'Manage') as HTMLButtonElement);
    expect(await within(other).findByText('Sign in')).toBeInTheDocument();

    fireEvent.click(
      within(other)
        .getByText('Runtime & Packages')
        .closest('button') as HTMLButtonElement,
    );
    services.status.mockImplementation(async (agentId: string) => ({
      installed: agentId !== 'claude',
      version: 'v18.20.4',
    }));
    fireEvent.click(action(other, 'Uninstall') as HTMLButtonElement);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(action(dialog, 'Uninstall') as HTMLButtonElement);

    await waitFor(() =>
      expect(services.uninstall).toHaveBeenCalledWith('claude'),
    );
    await waitFor(() =>
      expect(within(other).queryByText('Sign in')).not.toBeInTheDocument(),
    );
  });

  // The runtime is on disk whether or not it was ever connected, so it can always be removed.
  it('offers the uninstall of a free agent that was never connected', async () => {
    services.getAuthStatus.mockImplementation(async (agentId: string) =>
      agentId === 'claude'
        ? connected('claude', 'user@arduino.cc')
        : { authenticated: false, agentId: 'opencode' },
    );
    render(<AgentSettings />);
    const other = await card('OpenCode');
    await waitFor(() => expect(action(other, 'Manage')).toBeInTheDocument());
    expect(action(other, 'Connect')).toBeNull();

    fireEvent.click(action(other, 'Manage') as HTMLButtonElement);
    fireEvent.click(
      within(other)
        .getByText('Runtime & Packages')
        .closest('button') as HTMLButtonElement,
    );

    expect(action(other, 'Uninstall')).toBeEnabled();
    // Only Claude Code is connected: there is no other agent to choose as the default.
    expect(action(other, 'Set as default')).toBeNull();
    expect(within(other).queryByText('Account / Key')).not.toBeInTheDocument();
  });

  // Agent Mode stays mounted behind Settings and reads the same value, or it offers Connect for a removed runtime.
  it('shares what it finds installed with Agent Mode', async () => {
    services.status.mockImplementation(async (agentId: string) => ({
      installed: agentId === 'claude',
      version: 'v18.20.4',
    }));
    render(<AgentSettings />);

    await waitFor(() =>
      expect(useAiAssistantStore.getState().runtimeInstalled).toEqual({
        claude: true,
        opencode: false,
      }),
    );
  });

  // Go leaves the free space out when it could not measure it, and the message must not make a figure up.
  it('words a full disk with the sizes Go measured, and without them when it could not', async () => {
    services.status.mockImplementation(async (agentId: string) => ({
      installed: agentId === 'claude',
      version: 'v18.20.4',
    }));
    const diskFull = (sizes: object): Error =>
      new Error(
        JSON.stringify({
          code: 'airuntime_insufficient_disk_space',
          message: 'airuntime: insufficient disk space',
          ...sizes,
        }),
      );
    render(<AgentSettings />);
    const other = await card('OpenCode');
    await waitFor(() => expect(action(other, 'Install')).toBeInTheDocument());

    services.install.mockRejectedValueOnce(
      diskFull({ neededBytes: 1_610_612_736 }),
    );
    await act(async () => {
      fireEvent.click(action(other, 'Install') as HTMLButtonElement);
    });
    expect(
      await screen.findByText(
        'Not enough disk space to install the agent. Free some space, then try again.',
      ),
    ).toBeInTheDocument();

    // A disk with nothing left is measured too. No intl provider here, so the message comes as authored.
    services.install.mockRejectedValueOnce(
      diskFull({ neededBytes: 1_610_612_736, freeBytes: 0 }),
    );
    await act(async () => {
      fireEvent.click(action(other, 'Install') as HTMLButtonElement);
    });
    expect(
      await screen.findByText(
        'Not enough disk space to install the agent: it needs about {needed} free, and this disk has {free}.',
      ),
    ).toBeInTheDocument();
  });
});
