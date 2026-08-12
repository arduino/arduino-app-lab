import { describe, expect, it } from 'vitest';

import { MessagePart } from '../../../store';
import { timelineItems } from './Message.logic';

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
    const [item] = timelineItems([part], false);
    return { title: item.title, label: item.file?.label };
  };

  it('names and links the one file a read touched', () => {
    expect(
      row(
        toolCall('read', 'Read File', {
          input: { file_path: 'a1b2c3d4e5f6g7/python/main.py' },
        }),
      ),
    ).toEqual({ title: 'Read', label: 'python/main.py' });
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
      { title: 'Read', label: 'python/main.py' },
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
    ).toEqual({ title: 'Read', label: 'app/main.py' });
  });

  it('names the file a delete removed', () => {
    expect(
      row(
        toolCall('delete', 'Bash(rm app/old.py)', {
          input: { path: 'app/old.py' },
        }),
      ),
    ).toEqual({ title: 'Deleted', label: 'app/old.py' });
  });
});
