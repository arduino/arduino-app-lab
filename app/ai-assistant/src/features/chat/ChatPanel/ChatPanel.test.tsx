import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../../store';
import { ChatPanel } from './ChatPanel';
import type { ChatPanelLogic } from './ChatPanel.logic';

// jsdom has no layout engine, so it doesn't implement ResizeObserver — used by
// ChatInput's textarea auto-grow and the thread's own scroll tracking. Real
// browsers always have it; only the test environment needs the stub.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Which greeting shows is the host's call (the `docked` prop), not the panel's
// width: dragging the docked side panel wider must not turn it into the
// full-screen Agent Mode view.
const emptySessionLogic: ChatPanelLogic = {
  messages: [],
  isStreaming: false,
  turnTokens: 0,
  queuedPrompts: [],
  enqueue: vi.fn(),
  removeQueued: vi.fn(),
  clearQueued: vi.fn(),
  retryBootstrap: vi.fn(),
  models: [],
  setModel: vi.fn(),
  modes: [],
  setMode: vi.fn(),
  modelUnreadable: false,
  modelPickFailed: false,
  dismissModelPickFailed: vi.fn(),
  stop: vi.fn(),
  retry: vi.fn(),
  respondPermission: vi.fn(),
  respondChoices: vi.fn(),
  isLoadingSession: false,
  isNewSession: true,
  reopen: vi.fn(),
  newChat: vi.fn(),
  currentSessionId: null,
  canCompose: true,
  openFile: vi.fn(),
  dismissFileError: vi.fn(),
  dismissSessionActionError: vi.fn(),
  workspaceId: '',
  selectWorkspace: vi.fn(),
};

// Swapped per test so a case can render a started session instead of the empty one.
let logic: ChatPanelLogic = emptySessionLogic;

vi.mock('./ChatPanel.logic', () => ({
  useChatLogic: (): ChatPanelLogic => logic,
}));

afterEach(() => {
  logic = emptySessionLogic;
  useChatStore.getState().reset();
});

describe('ChatPanel empty state', () => {
  it('greets full-screen in Agent Mode', () => {
    render(<ChatPanel />);

    expect(
      screen.getByText('Hi, what do you want to build today?'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Ask about this app — the agent already sees the file you have open.',
      ),
    ).not.toBeInTheDocument();
  });

  it('puts a prompt whose session did not open back in the composer', () => {
    logic = {
      ...emptySessionLogic,
      restoredDraft: { text: 'Blink an LED on D13' },
    };
    render(<ChatPanel />);

    expect(screen.getByRole('textbox')).toHaveValue('Blink an LED on D13');
  });

  it('keeps the compact greeting in the docked panel, at any width', () => {
    render(<ChatPanel docked />);

    expect(
      screen.getByText(
        'Ask about this app — the agent already sees the file you have open.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Hi, what do you want to build today?'),
    ).not.toBeInTheDocument();
  });

  // A board with no apps of its own leaves only the general workspace to offer, and the row still has to say
  // which one the session opens in — hiding it there left "new session" with no stated scope at all.
  it('states the workspace even when the general one is the only choice', () => {
    render(
      <ChatPanel
        workspaces={[{ id: '', name: 'Arduino Apps', icon: '\u{1F4C1}' }]}
      />,
    );

    expect(screen.getByText('New session in')).toBeInTheDocument();
    expect(screen.getByText('Arduino Apps')).toBeInTheDocument();
  });
});

describe('ChatPanel top shadow', () => {
  // jsdom has no layout, so the thread's scroll geometry is set by hand. The thread is a
  // column-reverse scroller: offset 0 is the bottom and the top is -(scrollHeight - clientHeight).
  const scrollThread = (
    thread: HTMLElement,
    { scrollHeight, scrollTop }: { scrollHeight: number; scrollTop: number },
  ): void => {
    Object.defineProperty(thread, 'scrollHeight', {
      configurable: true,
      value: scrollHeight,
    });
    Object.defineProperty(thread, 'clientHeight', {
      configurable: true,
      value: 400,
    });
    thread.scrollTop = scrollTop;
    fireEvent.scroll(thread);
  };

  const renderThread = (): { thread: HTMLElement; shadow: HTMLElement } => {
    render(<ChatPanel />);
    return {
      thread: screen.getByTestId('chat-thread'),
      shadow: screen.getByTestId('chat-thread-shadow'),
    };
  };

  it('shows while older content sits above the viewport', () => {
    const { thread, shadow } = renderThread();

    scrollThread(thread, { scrollHeight: 1000, scrollTop: 0 });

    expect(shadow).toHaveStyle({ opacity: '1' });
  });

  it('hides once the reader reaches the top', () => {
    const { thread, shadow } = renderThread();
    scrollThread(thread, { scrollHeight: 1000, scrollTop: -300 });
    expect(shadow).toHaveStyle({ opacity: '1' });

    scrollThread(thread, { scrollHeight: 1000, scrollTop: -600 });

    expect(shadow).toHaveStyle({ opacity: '0' });
  });

  it('stays hidden when the thread is too short to scroll', () => {
    const { thread, shadow } = renderThread();

    scrollThread(thread, { scrollHeight: 400, scrollTop: 0 });

    expect(shadow).toHaveStyle({ opacity: '0' });
  });
});

// The docked panel names the workspace in its own header; Agent Mode renders the panel's toolbar
// instead, so the chip has to come from here or the workspace is only visible in the picker.
describe('ChatPanel toolbar', () => {
  it('names the session workspace next to the session title', () => {
    logic = {
      ...emptySessionLogic,
      isNewSession: false,
      currentSessionId: 'session-1',
      sessionTitle: 'Blink the LED',
      workspaceId: 'app-1',
      workspaceName: 'Weather Station',
    };

    render(
      <ChatPanel
        workspaces={[
          { id: '', name: 'Arduino Apps', icon: '\u{1F4C1}' },
          { id: 'app-1', name: 'Weather Station', icon: '\u{1F4C1}' },
        ]}
      />,
    );

    // CSS-module class names are hashed, so the toolbar is reached through the title it holds.
    // Scoping matters: an unscoped query passes with the chip anywhere in the tree, the picker
    // below the thread included.
    const title = screen.getByText('Blink the LED');
    const toolbar = title.parentElement as HTMLElement;

    expect(within(toolbar).getByText('Weather Station')).toBeInTheDocument();
    // The chip is the only place naming it: the workspace row is gone once the session has started.
    expect(screen.getAllByText('Weather Station')).toHaveLength(1);
  });

  // The docked header says "New session" meanwhile; a blank one read as a bug in the live pass.
  it('names an unnamed session in the header', () => {
    render(<ChatPanel />);

    expect(screen.getByText('New session')).toBeInTheDocument();
  });

  it('leaves the workspace chip out until the session has a title', () => {
    render(
      <ChatPanel
        workspaces={[{ id: '', name: 'Arduino Apps', icon: '\u{1F4C1}' }]}
      />,
    );

    expect(screen.getAllByText('Arduino Apps')).toHaveLength(1);
  });
});

// A session's workspace is fixed when it is created, so the row is offered only while the chat is empty.
describe('ChatPanel workspace row', () => {
  it('offers the picker on an empty chat', () => {
    render(
      <ChatPanel
        workspaces={[
          { id: '', name: 'Arduino Apps', icon: '\u{1F4C1}' },
          { id: 'app-1', name: 'Weather Station', icon: '\u{1F4C1}' },
        ]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Workspace' }),
    ).toBeInTheDocument();
  });

  it('drops the row once the session has started', () => {
    logic = {
      ...emptySessionLogic,
      isNewSession: false,
      currentSessionId: 'session-1',
      workspaceId: 'app-1',
      workspaceName: 'Weather Station',
    };

    render(
      <ChatPanel
        workspaces={[
          { id: '', name: 'Arduino Apps', icon: '\u{1F4C1}' },
          { id: 'app-1', name: 'Weather Station', icon: '\u{1F4C1}' },
        ]}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Workspace' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('New session in')).not.toBeInTheDocument();
  });
});

// Two panels can be mounted at once and `currentSessionId` is the shared pointer the sidebar
// highlights, not this panel's session: the choice card has to come from the session this panel
// displays, or an answer resolves on one thread and echoes into the other.
describe('ChatPanel pending choices', () => {
  it('shows the question of the session this panel displays, not the shared pointer', () => {
    const store = useChatStore.getState();
    store.setCurrentSessionId('other-session');
    store.addMessage('own-session', {
      id: 'm1',
      role: 'assistant',
      parts: [
        {
          type: 'choices',
          id: 'q1',
          choices: {
            id: 'q1',
            title: 'Which board?',
            options: [{ id: 'o1', label: 'VentunoQ' }],
          },
        },
      ],
    });
    logic = {
      ...emptySessionLogic,
      isNewSession: false,
      currentSessionId: 'own-session',
    };

    render(<ChatPanel />);

    expect(screen.getByText('Which board?')).toBeInTheDocument();
  });
});

// The design's rule: up to two queued prompts are listed as they are, from the third on they sit behind one header.
describe('ChatPanel queue', () => {
  const queued = (...texts: string[]): ChatPanelLogic => ({
    ...emptySessionLogic,
    isNewSession: false,
    currentSessionId: 'sess-1',
    isStreaming: true,
    queuedPrompts: texts.map((text, i) => ({ id: `q${i}`, text })),
    removeQueued: vi.fn(),
    clearQueued: vi.fn(),
  });
  // The count is an ICU plural, which only a real provider formats.
  const renderInIntl = (): void => {
    render(
      <IntlProvider locale="en">
        <ChatPanel />
      </IntlProvider>,
    );
  };

  it('lists two prompts as they are, oldest first, each removable', () => {
    logic = queued('first', 'second');

    renderInIntl();

    const rows = screen.getAllByRole('button', { name: 'Remove from queue' });
    expect(rows).toHaveLength(2);
    expect(
      screen.getAllByText(/^(first|second)$/).map((el) => el.textContent),
    ).toEqual(['first', 'second']);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();

    fireEvent.click(rows[0]);
    expect(logic.removeQueued).toHaveBeenCalledWith('q0');
  });

  it('collapses three into a header with the count, and opens the full list below it', () => {
    logic = queued('first', 'second', 'third');

    renderInIntl();

    const header = screen.getByRole('button', { name: '3 queued' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('first')).not.toBeInTheDocument();

    fireEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByRole('button', { name: 'Remove from queue' }),
    ).toHaveLength(3);
    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('drops the whole queue with Clear all', () => {
    logic = queued('first', 'second', 'third');

    renderInIntl();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(logic.clearQueued).toHaveBeenCalledTimes(1);
  });
});

// The banner says why a turn failed: the agent's reason when it gave one, the panel's own words when it gave none.
describe('ChatPanel request error', () => {
  const failed = (message: string, kind?: string): ChatPanelLogic => ({
    ...emptySessionLogic,
    isNewSession: false,
    currentSessionId: 'sess-1',
    retry: vi.fn(),
    newChat: vi.fn(),
    requestError: { messageId: 'm1', message, kind },
  });

  it('shows the cause the agent gave', () => {
    logic = failed('Tool permission request failed: socket closed');
    render(<ChatPanel />);

    expect(screen.getByText('Request failed')).toBeInTheDocument();
    expect(
      screen.getByText('Tool permission request failed: socket closed'),
    ).toBeInTheDocument();
  });

  it('shows the whole first line of a long cause', () => {
    const line = `spawn failed: ${'x'.repeat(300)}`;
    logic = failed(`${line}\n    at spawn (node:1:1)`);
    render(<ChatPanel />);

    expect(screen.getByText(line)).toBeInTheDocument();
  });

  it('caps a JSON cause without splitting a surrogate pair', () => {
    // 200 code points end on the emoji, which takes two UTF-16 units.
    logic = failed(`{"error":"${'x'.repeat(189)}😀${'y'.repeat(100)}"}`);
    render(<ChatPanel />);

    expect(
      screen.getByText(`{"error":"${'x'.repeat(189)}😀…`),
    ).toBeInTheDocument();
  });

  it('explains an internal error with no cause, and offers Retry', () => {
    logic = failed('Internal error');
    render(<ChatPanel />);

    expect(screen.queryByText('Internal error')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'The agent reported an internal error and gave no reason. Try again; if it happens again, start a new chat.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(logic.retry).toHaveBeenCalledWith('m1');
  });

  // The host's own words for these two are English only; a retry of a chat the agent no longer has fails the same way.
  it('offers a new chat when the agent no longer has the chat', () => {
    logic = failed('The agent no longer has this chat.', 'session_gone');
    render(<ChatPanel />);

    expect(
      screen.getByText(
        'The agent no longer has this chat, so it cannot reopen it. Start a new chat.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(logic.newChat).toHaveBeenCalled();
  });

  it('offers Retry when the agent could not reopen the chat this time', () => {
    logic = failed('Could not reopen.', 'session_load_failed');
    render(<ChatPanel />);

    expect(
      screen.getByText('The agent could not reopen this chat. Try again.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(logic.retry).toHaveBeenCalledWith('m1');
  });
});
