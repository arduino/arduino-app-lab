import { render, screen } from '@testing-library/react';
import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { messages } from '../../../../messages';
import { MessagePart } from '../../../../store';
import { StreamingMarkdown } from '../Markdown';
import { activityHeader } from './activityHeader';
import {
  markdownBlocks,
  thoughtLabel,
  withoutTransportError,
} from './messageSegments';
import { timelineItems } from './timelineItems';

const { formatMessage, formatList } = createIntl({ locale: 'en' });

const toolCall = (
  kind: string,
  title: string,
  extra: { input?: unknown; output?: string } = {},
): MessagePart => ({
  type: 'tool_call',
  toolCall: { id: 't1', kind, title, status: 'completed', ...extra },
});

// A row's title comes from the tool's paths when it has them, so what counts as a path decides what
// the row says. Everything here is a shape the adapter really sends.
describe('timelineItems file rows', () => {
  const row = (part: MessagePart): { title: string; label?: string } => {
    const [item] = timelineItems([part], false, formatMessage);
    return { title: item.title, label: item.file?.label };
  };

  it('names and links the one file a read touched', () => {
    expect(
      row(
        toolCall('read', 'Read File', {
          input: { file_path: 'a1b2c3d4e5f6g7/python/main.py' },
        }),
      ),
    ).toEqual({ title: 'Read', label: 'main.py' });
  });

  it('counts several files instead of naming one', () => {
    expect(
      row(
        toolCall('read', 'Read File', {
          input: { paths: ['app/main.py', 'app/boot.py'] },
        }),
      ),
    ).toEqual({ title: 'Read 2 files', label: undefined });
  });

  it('links a path with a space in it', () => {
    // The mirror lives under 'Application Support' on macOS, so most real paths have one.
    expect(
      row(
        toolCall('read', 'Read File', {
          input: {
            file_path:
              '/Users/x/Library/Application Support/App Lab/ai-mirror/a1b2c3d4e5f6g7/main.py',
          },
        }),
      ),
    ).toEqual({ title: 'Read', label: 'main.py' });
  });

  it('links the path the title names when the input has none', () => {
    // Read tools don't always report their input; the title is then the only path we have.
    expect(row(toolCall('read', 'Read a1b2c3d4e5f6g7/python/main.py'))).toEqual(
      { title: 'Read', label: 'main.py' },
    );
  });

  it('keeps the tool title when the output is all it has', () => {
    // The output is the *contents* of the file read, so scanning it would count lines as files.
    expect(
      row(
        toolCall('read', 'Read main.py', {
          output: 'import time\nfrom machine import Pin\nled.value(1)\n',
        }),
      ),
    ).toEqual({ title: 'Read main.py', label: undefined });
  });

  it('keeps an MCP label when the input carries no path', () => {
    expect(
      row(
        toolCall('read', 'mcp__app_lab__apps_logs', {
          input: { appId: 'abc', since: '1.5m' },
        }),
      ),
    ).toEqual({ title: 'Read app logs', label: undefined });
  });

  it('ignores prose that merely mentions a file', () => {
    expect(
      row(
        toolCall('read', 'Read File', {
          input: { file_path: 'app/main.py', note: 'see boot.py' },
        }),
      ),
    ).toEqual({ title: 'Read', label: 'main.py' });
  });

  // The reported bug: a file the agent touched outside the mirror kept its whole absolute path, which on macOS runs
  // past the width of the panel and buries the name the row is there to show.
  it('names a file that lives outside the mirror', () => {
    expect(
      row(
        toolCall('edit', 'Edit File', {
          input: {
            file_path:
              '/Users/me/Library/Application Support/arduino-app-lab/ai-runtime/claude/config/projects/-Users-me/settings.json',
          },
        }),
      ),
    ).toEqual({ title: 'Edited', label: 'settings.json' });
  });

  // Removing a folder reports a trailing slash, which would otherwise leave the row with an empty name.
  it('names a removed folder', () => {
    expect(
      row(
        toolCall('delete', 'Bash(rm -r app/assets/)', {
          input: { path: 'app/assets/' },
        }),
      ),
    ).toEqual({ title: 'Deleted', label: 'assets' });
  });

  it('names the file a delete removed', () => {
    expect(
      row(
        toolCall('delete', 'Bash(rm app/old.py)', {
          input: { path: 'app/old.py' },
        }),
      ),
    ).toEqual({ title: 'Deleted', label: 'old.py' });
  });
});

// The expanded panel of a board_exec row: the output alone never says which command produced it.
describe('timelineItems board_exec body', () => {
  const body = (part: MessagePart): string | undefined => {
    const [item] = timelineItems([part], false, formatMessage);
    const details = item.details as
      | { props?: { children?: unknown } }
      | undefined;
    return typeof details?.props?.children === 'string'
      ? details.props.children
      : undefined;
  };

  const exec = (input: unknown, output?: string): MessagePart =>
    toolCall('execute', 'mcp__arduino-board__board_exec', { input, output });

  it('leads with the command, then the output', () => {
    expect(body(exec({ command: 'ls python' }, 'main.py\nboot.py'))).toBe(
      '> ls python\n\nmain.py\nboot.py',
    );
  });

  it('still shows a command that printed nothing', () => {
    expect(body(exec({ command: 'touch python/new.py' }, ''))).toBe(
      '> touch python/new.py',
    );
  });

  it('leaves the output of any other tool alone', () => {
    expect(
      body(
        toolCall('execute', 'Bash', {
          input: { command: 'ls' },
          output: 'main.py',
        }),
      ),
    ).toBe('main.py');
  });
});

// The expanded body carries raw tool output, which is where the mirror's own paths surface.
describe('timelineItems body paths', () => {
  const body = (part: MessagePart): string | undefined => {
    const [item] = timelineItems([part], false, formatMessage);
    const details = item.details as
      | { props?: { children?: unknown } }
      | undefined;
    return typeof details?.props?.children === 'string'
      ? details.props.children
      : undefined;
  };

  // A search runs from the mirror root, so every hit is prefixed with the opaque checkout key.
  it('drops the checkout key from a search result', () => {
    expect(
      body(
        toolCall('search', 'Find', {
          output:
            '2923045065__dXNlcjo0/sketch/sketch.ino\n2923045065__dXNlcjo0/sketch/sketch.yaml',
        }),
      ),
    ).toBe('sketch/sketch.ino\nsketch/sketch.yaml');
  });

  // The mirror root has spaces on macOS, so cleaning an absolute path token by token strips the last and leaves the rest.
  it('drops an absolute mirror path whose root has spaces', () => {
    expect(
      body(
        toolCall('read', 'Read File', {
          output:
            'File not found: /Users/x/Library/Application Support/App Lab/ai-mirror/2923045065__k/sketch/sketch.ino',
        }),
      ),
    ).toBe('File not found: sketch/sketch.ino');
  });

  // The span that reaches back over those spaces must not run past an earlier path on the same line.
  it('leaves another absolute path on the line alone', () => {
    expect(
      body(
        toolCall('execute', 'Bash', {
          output:
            'cp /etc/motd /Users/x/Library/Application Support/App Lab/ai-mirror/2923045065__k/sketch/sketch.ino',
        }),
      ),
    ).toBe('cp /etc/motd sketch/sketch.ino');
  });

  // Its whole answer is the mirror directory: a machine path that means nothing to the reader.
  it('gives apps_checkout no body at all', () => {
    expect(
      body(
        toolCall('read', 'mcp__arduino-board__apps_checkout', {
          output:
            '/Users/x/Library/Application Support/arduino-app-lab/ai-mirror/2923045065__dXNlcjo0',
        }),
      ),
    ).toBeUndefined();
  });
});

const text = (value: string): MessagePart => ({
  type: 'text',
  id: 't-1',
  text: value,
});

// The agent narrates its own transport failure into the turn; the composer banner says the same
// thing in the user's language, so the raw line goes — but never the answer it managed to write.
describe('withoutTransportError', () => {
  it('drops the trailing error and keeps the partial answer', () => {
    expect(
      withoutTransportError([
        text(
          "I'll load the app-listing tool and query the board.\n\nAPI Error: Connection closed mid-response. The response above may be incomplete.",
        ),
      ]),
    ).toEqual([text("I'll load the app-listing tool and query the board.")]);
  });

  it('leaves nothing behind when the error was all the turn produced', () => {
    expect(withoutTransportError([text('API Error: fetch failed')])).toEqual(
      [],
    );
  });

  it('keeps prose that merely mentions a connection', () => {
    const parts = [text('Your board lost its Wi-Fi connection at boot.')];
    expect(withoutTransportError(parts)).toEqual(parts);
  });

  it('leaves a turn whose last part is a tool call alone', () => {
    const parts = [
      text('API Error: fetch failed'),
      toolCall('read', 'Read File'),
    ];
    expect(withoutTransportError(parts)).toEqual(parts);
  });
});

// A streaming reply parses each block on its own, so a split must not change what the reader sees.
describe('markdownBlocks', () => {
  it('splits at blank lines, the growing tail last', () => {
    expect(markdownBlocks('# Title\n\nFirst.\n\nSecond, still writ')).toEqual([
      '# Title',
      'First.',
      'Second, still writ',
    ]);
  });

  it('keeps a code fence whole, an unclosed one too', () => {
    const fence = '```python\nx = 1\n\ny = 2\n```';
    expect(markdownBlocks(`Before.\n\n${fence}\n\nAfter.`)).toEqual([
      'Before.',
      fence,
      'After.',
    ]);
    expect(markdownBlocks('Intro.\n\n~~~\na()\n\nb(')).toEqual([
      'Intro.',
      '~~~\na()\n\nb(',
    ]);
  });

  it('keeps a list item with its indented continuation', () => {
    const list = '1. Step one\n\n   More on step one.\n2. Step two';
    expect(markdownBlocks(list)).toEqual([list]);
  });

  it('numbers an item split off a loose list as the finished reply does', () => {
    render(<StreamingMarkdown text={'1. Install\n\n2. Run'} />);
    const [, second] = screen.getAllByRole('list');
    expect(second).toHaveAttribute('start', '2');
  });
});

// The badge is the only thing in the transcript saying an action landed on another app; without it a cross-app edit reads like a local one.
describe('timeline — outside the workspace', () => {
  const call = (outsideWorkspace: boolean): MessagePart => ({
    type: 'tool_call',
    toolCall: {
      id: 't1',
      title: 'Edit',
      kind: 'edit',
      status: 'completed',
      outsideWorkspace,
    },
  });

  it('badges a call the host resolved as outside', () => {
    const [row] = timelineItems([call(true)], true, formatMessage);
    expect(row.outsideLabel).toBe(formatMessage(messages.permOutsideWorkspace));
  });

  it('leaves a call inside the workspace unbadged', () => {
    const [row] = timelineItems([call(false)], true, formatMessage);
    expect(row.outsideLabel).toBeUndefined();
  });
});

// The summary and the reasoning label are translated text: a plural rule decides "file" or "files".
describe('activity labels', () => {
  const completed = (id: string, kind: string): MessagePart => ({
    type: 'tool_call',
    toolCall: { id, kind, title: kind, status: 'completed' },
  });

  it('sums up what the turn did, one phrase per kind', () => {
    const parts = [
      completed('a', 'read'),
      completed('b', 'read'),
      completed('c', 'execute'),
      completed('d', 'fetch'),
    ];
    expect(activityHeader(parts, formatMessage, false, formatList)).toBe(
      'Read 2 files, ran 1 command, fetched 1 page',
    );
  });

  // The words, their case and their order are the translator's, and the locale joins the phrases.
  it('takes every phrase of the summary from the translation as written', () => {
    const german = createIntl({
      locale: 'de',
      messages: {
        [messages.chatActionRead.id]:
          '{count, plural, one {# Datei gelesen} other {# Dateien gelesen}}',
        [messages.chatActionRanCommandsNext.id]:
          '{count, plural, one {# Befehl ausgeführt} other {# Befehle ausgeführt}}',
        [messages.chatActionFetchedNext.id]:
          '{count, plural, one {# Seite abgerufen} other {# Seiten abgerufen}}',
      },
    });
    const parts = [
      completed('a', 'read'),
      completed('b', 'read'),
      completed('c', 'execute'),
      completed('d', 'fetch'),
    ];

    expect(
      activityHeader(parts, german.formatMessage, false, german.formatList),
    ).toBe('2 Dateien gelesen, 1 Befehl ausgeführt und 1 Seite abgerufen');
  });

  it('joins the phrases with the list separator of the locale', () => {
    const chinese = createIntl({
      locale: 'zh',
      messages: {
        [messages.chatActionRead.id]:
          '{count, plural, other {读取了 # 个文件}}',
        [messages.chatActionRanCommandsNext.id]:
          '{count, plural, other {运行了 # 条命令}}',
      },
    });
    const parts = [
      completed('a', 'read'),
      completed('b', 'read'),
      completed('c', 'execute'),
    ];

    expect(
      activityHeader(parts, chinese.formatMessage, false, chinese.formatList),
    ).toBe('读取了 2 个文件、运行了 1 条命令');
  });

  // Older WebKit has no Intl.ListFormat, and react-intl's formatList then gives no text at all.
  it('joins the phrases with commas where the runtime has no list formatter', () => {
    const listFormat = Intl.ListFormat;
    Reflect.deleteProperty(Intl, 'ListFormat');
    try {
      const fresh = createIntl({ locale: 'en', onError: () => undefined });
      const parts = [completed('a', 'read'), completed('b', 'execute')];

      expect(
        activityHeader(parts, fresh.formatMessage, false, fresh.formatList),
      ).toBe('Read 1 file, ran 1 command');
      expect(activityHeader(parts, fresh.formatMessage, false)).toBe(
        'Read 1 file, ran 1 command',
      );
    } finally {
      Object.defineProperty(Intl, 'ListFormat', {
        value: listFormat,
        writable: true,
        configurable: true,
      });
    }
  });

  it('says how long the agent thought, when it knows', () => {
    expect(thoughtLabel(formatMessage, 0, 4200)).toBe('Thought for 4s');
    expect(thoughtLabel(formatMessage)).toBe('Thought');
  });
});
