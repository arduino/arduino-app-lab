import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthStatus, listSessions, start } from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { AgentPanelContainer } from './AgentPanelContainer';

// ChatPanel is reused unchanged (out of scope here) and needs a full coding-agent-service DI setup
// to mount; stub it so this file tests only the container's own branch/header/CTA behaviour.
vi.mock('../chat/ChatPanel/ChatPanel', () => ({
  ChatPanel: (): JSX.Element => <div data-testid="chat-panel" />,
}));

// The mount-time auth refresh and history-list fetch (see agentPanelContainer.logic.ts) hit the
// real DI services otherwise, which throw "not implemented" outside a running agent process.
vi.mock('../../services', () => ({
  listAgents: (): { id: string; comingSoon?: boolean }[] => [{ id: 'claude' }],
  getAuthStatus: vi.fn(),
  currentAgent: (): Promise<string> => Promise.resolve('claude'),
  start: vi.fn(),
  listSessions: vi.fn(),
}));

describe('AgentPanelContainer', () => {
  beforeEach(() => {
    useAiAssistantStore.getState().setAuth('claude', { authenticated: false });
    useAiAssistantStore.setState({ agentDown: undefined });
    useChatStore.getState().reset();
    vi.mocked(getAuthStatus).mockResolvedValue({ authenticated: false });
    vi.mocked(start).mockResolvedValue(undefined);
    vi.mocked(listSessions).mockResolvedValue([]);
  });

  it('shows the app-name chip and the no-agent CTA when nothing is connected', async () => {
    const onSetupAgent = vi.fn();
    render(
      <AgentPanelContainer
        appName="Snack Sorter"
        appId="dXNlcjpzbmFjay1zb3J0ZXI"
        onClose={vi.fn()}
        onSetupAgent={onSetupAgent}
      />,
    );

    expect(
      await screen.findByText('Install an agent to build and edit with it.'),
    ).toBeInTheDocument();
    // Two matches: the visible title and its (always-rendered, hidden until
    // hovered) tooltip — see useTooltip in AgentPanelContainer.tsx.
    expect(screen.getAllByText('AI Assistant').length).toBeGreaterThan(0);
    expect(screen.getByText('Snack Sorter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set up an agent' }));
    expect(onSetupAgent).toHaveBeenCalledTimes(1);
  });

  it('renders the chat panel once an agent is connected', async () => {
    vi.mocked(getAuthStatus).mockResolvedValue({
      authenticated: true,
      agentId: 'claude',
    });
    render(
      <AgentPanelContainer
        appName="Snack Sorter"
        appId="dXNlcjpzbmFjay1zb3J0ZXI"
        onClose={vi.fn()}
        onSetupAgent={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
    // Two matches: the visible title and its tooltip — see the comment above.
    expect(screen.getAllByText('New session').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Install an agent to build and edit with it.'),
    ).not.toBeInTheDocument();
  });

  // Agent Mode leaves auth true in the store; mounting the chat on that alone races this panel's own start() and lands on "agent not started".
  it('holds the chat back until its own start resolves, however connected the store looks', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    useAiAssistantStore
      .getState()
      .setAuth('claude', { authenticated: true, agentId: 'claude' });
    vi.mocked(getAuthStatus).mockResolvedValue({
      authenticated: true,
      agentId: 'claude',
    });
    let processUp = (): void => undefined;
    vi.mocked(start).mockReturnValue(
      new Promise<void>((resolve) => {
        processUp = (): void => resolve();
      }),
    );
    render(
      <AgentPanelContainer
        appName="Snack Sorter"
        appId="dXNlcjpzbmFjay1zb3J0ZXI"
        onClose={vi.fn()}
        onSetupAgent={vi.fn()}
      />,
    );

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();

    processUp();
    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
  });

  // The editor has no other way back to a working agent after it gave up restarting.
  it('offers Reconnect once the agent gave up restarting, and starts it again', async () => {
    useAiAssistantStore.setState({ selectedAgentId: 'claude' });
    vi.mocked(getAuthStatus).mockResolvedValue({
      authenticated: true,
      agentId: 'claude',
    });
    render(
      <AgentPanelContainer
        appName="Snack Sorter"
        appId="dXNlcjpzbmFjay1zb3J0ZXI"
        onClose={vi.fn()}
        onSetupAgent={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();

    act(() =>
      useAiAssistantStore
        .getState()
        .setAgentDown({ agentId: 'claude', reason: 'crashed' }),
    );
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
    const starts = vi.mocked(start).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(starts + 1);
  });

  it('closes on the header close button and starts a new session on new-chat', async () => {
    const onClose = vi.fn();
    render(
      <AgentPanelContainer
        appName="Snack Sorter"
        appId="dXNlcjpzbmFjay1zb3J0ZXI"
        onClose={onClose}
        onSetupAgent={vi.fn()}
      />,
    );

    // Awaited before the clicks so the mount effects settle inside act(), not after the test has ended.
    expect(
      await screen.findByText('Install an agent to build and edit with it.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(useChatStore.getState().sessionRequest).toMatchObject({
      type: 'new',
    });
  });
});
