import { type FormatMessage } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../../messages';
import { MessagePart } from '../../../../store';
import {
  type TimelineItem,
  type TimelineItemType,
  fileNameFromPath,
  formatToolTitle,
  mcpToolName,
  stripKeysFromText,
  webToolLabel,
} from '../../../../ui';
import thinkingStyles from '../../../../ui/Thinking/thinking.module.scss';
import { Markdown } from '../Markdown';
import styles from '../message.module.scss';
import { KIND_PHRASE } from './activityHeader';
import { type ToolCallData, thoughtLabel } from './messageSegments';

// ACP tool kind → timeline row type (icon). Unknown kinds fall back to other.
const TOOL_KIND_TO_TYPE: Record<string, TimelineItemType> = {
  read: 'read',
  execute: 'execute',
  edit: 'execute',
  delete: 'execute',
  move: 'execute',
  search: 'execute',
  fetch: 'execute',
  think: 'task',
  switch_mode: 'execute',
};

// A file name ends in an extension: a letter first, so a stringy value like '1.5m' isn't one.
const FILE_EXT = /\.[a-z][a-z0-9]{0,9}$/i;

/** Accepts a plausible single file path/name, else undefined (drops prose, multi-line and over-long values). */
const normalizeReadFile = (value: string): string | undefined => {
  const text = value.trim().replace(/^['"]|['"]$/g, '');
  if (!text || text.length > 300) {
    return undefined;
  }
  if (text.includes('\n') || text.includes('\r')) {
    return undefined;
  }
  // A separator or an extension: without one, any stringy input on a file tool would read as a path.
  if (!text.includes('/') && !text.includes('\\') && !FILE_EXT.test(text)) {
    return undefined;
  }
  return text;
};

// The keys a file tool puts its target(s) under, at any depth. Every *other* string is skipped: a walk
// over all of them takes prose that merely names a file ("see boot.py") — or any stringy value — for one.
const PATH_KEYS = new Set([
  'file',
  'files',
  'file_path',
  'file_paths',
  'filePath',
  'filePaths',
  'notebook_path',
  'notebookPath',
  'path',
  'paths',
]);

/** Walks a read tool's rawInput (any shape) collecting up to 6 paths from its path-carrying keys. */
const collectReadFilesFromInput = (input: unknown): string[] => {
  const files = new Set<string>();

  const visit = (value: unknown, isPath: boolean): void => {
    if (typeof value === 'string') {
      const file = isPath ? normalizeReadFile(value) : undefined;
      if (file) {
        files.add(file);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, isPath));
      return;
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, entry]) =>
        visit(entry, isPath || PATH_KEYS.has(key)),
      );
    }
  };

  visit(input, false);
  return Array.from(files).slice(0, 6);
};

/**
 * The paths a native tool's own title names ("Read python/main.py"). Read tools don't always report
 * their input, and then the title is all we have — linking what the row already shows adds no guess.
 */
const filesFromTitle = (title: string): string[] => {
  if (title.startsWith('mcp__')) {
    return []; // a wire name, never a path
  }
  const files = new Set<string>();
  title.split(/\s+/).forEach((word) => {
    // Titles are prose: 'Read a.py,' and 'Read(a.py)' both end on punctuation that isn't in the name.
    const token = word.replace(/^[('"]+|[)'",.;:]+$/g, '');
    const file =
      token.includes('/') || token.includes('\\')
        ? normalizeReadFile(token)
        : undefined;
    if (file) {
      files.add(file);
    }
  });
  return Array.from(files).slice(0, 6);
};

// The target file of a tool acting on exactly one, from the known input field only — a path scan
// would hit the diff (edit/write) or the destination (move).
const singleTargetFile = (input: unknown): string | undefined => {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const o = input as Record<string, unknown>;
  const fp = o.file_path ?? o.filePath ?? o.path;
  return typeof fp === 'string' ? normalizeReadFile(fp) : undefined;
};

// Kinds whose paths a row can name. Never from the tool's *output*: a read tool's output is the
// contents of the file it read, so scanning it counts lines of code as files.
const FILE_KINDS = new Set(['read', 'edit', 'delete', 'move']);

// Full paths of the files a tool acted on, from its input, falling back to the ones its title names.
const readFiles = (tool: ToolCallData): string[] => {
  if (!FILE_KINDS.has(tool.kind)) {
    return [];
  }
  if (tool.kind !== 'read') {
    const file = singleTargetFile(tool.input);
    return file ? [file] : [];
  }

  const fromInput = collectReadFilesFromInput(tool.input);
  return fromInput.length > 0 ? fromInput : filesFromTitle(tool.title);
};

/**
 * What a file row says, built from the tool's kind and input paths instead of its title — titles are
 * the agent's free text ("Edit <path>", a bare "Read File"), the paths are structured data. One file
 * is named and linked, several are counted. Undefined keeps the agent's title (every non-file tool).
 */
const fileRowLabel = (
  kind: string,
  files: string[],
  formatMessage: FormatMessage,
): { title: string; file?: TimelineItem['file'] } | undefined => {
  const phrase = KIND_PHRASE[kind];
  if (!phrase || files.length === 0) {
    return undefined;
  }
  if (files.length > 1) {
    return { title: formatMessage(phrase.count, { count: files.length }) };
  }
  const path = files[0];
  // The row is a link, so it shows the file name alone — the full path is kept for opening it.
  return {
    title: formatMessage(phrase.verb),
    file: { path, label: fileNameFromPath(path.replace(/\\/g, '/')) },
  };
};

// board_exec's panel opens on the output alone, which doesn't say what produced it — a bare file listing could be any
// of a dozen commands. Return the command so the body can lead with it; empty for every other tool.
const boardExecCommand = (title: string, input: unknown): string => {
  if (mcpToolName(title) !== 'board_exec') {
    return '';
  }
  const command = (input as { command?: unknown } | null)?.command;
  return typeof command === 'string' ? command.trim() : '';
};

/** Narrows a tool status to the settled subset the timeline colors (completed/failed), else undefined. */
const timelineStatus = (
  status: ToolCallData['status'],
): TimelineItem['status'] | undefined => {
  if (status === 'completed' || status === 'failed') {
    return status;
  }
  return undefined;
};

// Tool output from the adapter often arrives wrapped in a markdown code fence; we show it in a <pre>, so drop the fence lines (they'd otherwise render as literal backticks).
const stripCodeFence = (text: string): string => {
  const lines = text.trim().split('\n');
  if (
    lines.length >= 2 &&
    lines[0].startsWith('```') &&
    lines[lines.length - 1].trim() === '```'
  ) {
    return lines.slice(1, -1).join('\n');
  }
  return text;
};

/**
 * Builds the activity timeline rows for a turn: consecutive reasoning merged into one "Thinking"
 * row in place, one row per tool call (its output as the expandable body), and a terminal "Done"
 * once the turn has settled.
 */
export const timelineItems = (
  parts: MessagePart[],
  done: boolean,
  // The caller's: this builder has no intl of its own.
  formatMessage: FormatMessage,
  liveTail = false,
): TimelineItem[] => {
  const outsideWorkspaceLabel = formatMessage(messages.permOutsideWorkspace);
  const outsideAppLabel = (app: string): string =>
    formatMessage(messages.permOutsideApp, { app });
  const items: TimelineItem[] = [];
  let reasoning: string[] = [];
  let reasoningStart: number | undefined;
  let reasoningEnd: number | undefined;

  const flushReasoning = (live: boolean): void => {
    const text = reasoning.join('\n\n').trim();
    const start = reasoningStart;
    const end = reasoningEnd;
    reasoning = [];
    reasoningStart = undefined;
    reasoningEnd = undefined;

    if (text.length === 0) {
      return; // empty reasoning (e.g. a blank thought chunk before a tool) → no bodyless row
    }

    items.push({
      id: `thinking-${items.length}`,
      type: 'thinking',
      title: live
        ? formatMessage(messages.chatThinking)
        : thoughtLabel(formatMessage, start, end),
      details: (
        <div className={thinkingStyles['thinking-details']}>
          <Markdown text={text} />
        </div>
      ),
    });
  };

  for (const part of parts) {
    if (part.type === 'thinking') {
      reasoning.push(part.text);
      if (part.startedAt !== undefined) {
        reasoningStart =
          reasoningStart === undefined
            ? part.startedAt
            : Math.min(reasoningStart, part.startedAt);
      }
      if (part.endedAt !== undefined) {
        reasoningEnd =
          reasoningEnd === undefined
            ? part.endedAt
            : Math.max(reasoningEnd, part.endedAt);
      }
      continue;
    }
    if (part.type === 'tool_call') {
      flushReasoning(false);
      const { id, kind, title, status, output } = part.toolCall;
      // ExitPlanMode (plan-mode exit) is surfaced as the plan-approval card, not a timeline row.
      if (kind === 'switch_mode') {
        continue;
      }
      const settled = status === 'completed' || status === 'failed';
      // apps_checkout answers with the mirror directory, which is plumbing the user has no use for: the row's title
      // already says what happened, so it gets no body rather than a machine path.
      const isCheckout = mcpToolName(title) === 'apps_checkout';
      const command = boardExecCommand(title, part.toolCall.input);
      // The command leads, then a blank line, then the output — so a run with no output still shows what ran.
      const body =
        settled && !isCheckout
          ? [
              command && `> ${command}`,
              // Outputs are full of mirror paths (a search result is a list of them): show them as the user's own.
              output !== undefined && stripKeysFromText(stripCodeFence(output)),
            ]
              .filter(Boolean)
              .join('\n\n')
          : '';
      const fileRow = fileRowLabel(
        kind,
        readFiles(part.toolCall),
        formatMessage,
      );
      items.push({
        id,
        type: TOOL_KIND_TO_TYPE[kind] ?? 'other',
        title:
          fileRow?.title ??
          webToolLabel(kind, part.toolCall.input) ??
          formatToolTitle(title),
        status: timelineStatus(status),
        file: fileRow?.file,
        ...(part.toolCall.outsideWorkspace
          ? {
              outsideLabel: part.toolCall.outsideApp
                ? outsideAppLabel(part.toolCall.outsideApp)
                : outsideWorkspaceLabel,
            }
          : {}),
        details: body ? (
          <pre className={styles['timeline-output']}>{body}</pre>
        ) : undefined,
      });
    }
  }
  flushReasoning(liveTail);

  if (done) {
    items.push({
      id: 'done',
      type: 'done',
      title: formatMessage(messages.chatActivityDone),
      status: 'completed',
    });
  }

  return items;
};
