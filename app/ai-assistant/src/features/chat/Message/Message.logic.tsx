import {
  Children,
  isValidElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { MessagePart } from '../../../store';
import {
  type TimelineItem,
  type TimelineItemType,
  CodeBlock,
  formatToolTitle,
  Heading,
  InlineDiff,
  Link,
  List,
  stripKeyFromPath,
  Table,
  Text,
  webToolLabel,
} from '../../../ui';
import thinkingStyles from '../../../ui/Thinking/thinking.module.scss';
import styles from './message.module.scss';

type ToolCallData = Extract<MessagePart, { type: 'tool_call' }>['toolCall'];

// verb + singular + plural per ACP tool kind, for the human action summary.
const KIND_PHRASE: Record<string, [string, string, string]> = {
  read: ['Read', 'file', 'files'],
  edit: ['Edited', 'file', 'files'],
  delete: ['Deleted', 'file', 'files'],
  move: ['Moved', 'file', 'files'],
  execute: ['Ran', 'command', 'commands'],
  search: ['Ran', 'search', 'searches'],
  fetch: ['Fetched', 'page', 'pages'],
  think: ['Ran', 'task', 'tasks'],
};

// Phase shown by the live loader while streaming, from the active tool (or thinking otherwise).
const PHASE_BY_KIND: Record<string, string> = {
  read: 'Reading files',
  edit: 'Editing files',
  delete: 'Editing files',
  move: 'Editing files',
  execute: 'Running commands',
  search: 'Searching',
  fetch: 'Fetching',
  think: 'Thinking',
};

// Rotated every 20s while the agent is just reasoning, so a long wait feels alive.
const THINKING_PHRASES = [
  'Thinking',
  'Working through it',
  'Reasoning it out',
  'Connecting the dots',
  'Almost there',
];

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

// Claude Code's internal plumbing tools, not user-facing actions: ToolSearch (deferred-tool loader) and
// ScheduleWakeup (the agent's self-pacing wait between polls, e.g. while a slow app start boots).
const INTERNAL_TOOL_TITLES = new Set(['ToolSearch', 'ScheduleWakeup']);

const toPlainText = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(toPlainText).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return toPlainText(node.props.children);
  }

  return '';
};

/**
 * Flattens a GFM table's thead/tbody/tr/th/td nodes into plain-string rows so we
 * can feed our agnostic <Table>. First row = headers (GFM tables always have one).
 */
const tableRows = (node: ReactNode): string[][] => {
  const rows: string[][] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return;
    }

    if (child.type === 'tr') {
      const cells: string[] = [];
      Children.forEach(child.props.children, (cell) => {
        if (
          isValidElement<{ children?: ReactNode }>(cell) &&
          (cell.type === 'th' || cell.type === 'td')
        ) {
          cells.push(toPlainText(cell.props.children));
        }
      });
      rows.push(cells);
      return;
    }

    // thead / tbody wrappers — recurse to reach the rows.
    rows.push(...tableRows(child.props.children));
  });

  return rows;
};

/**
 * Second-level dispatch: maps markdown nodes to UI primitives. Used only for
 * `text` parts, which carry the agent's prose/GFM (`agent_message_chunk`). The
 * first-level dispatch — choosing this renderer vs a structured component — is
 * the part-type switch in Message.tsx.
 */
export const markdownComponents: Components = {
  table({ children }) {
    const [headers, ...rows] = tableRows(children);
    if (!headers) {
      return null;
    }

    return <Table headers={headers} rows={rows} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  a: Link,
  img({ src, alt, title }) {
    if (!src) {
      return <>{alt}</>;
    }

    return (
      <Link href={src} title={title ?? src}>
        {alt || src}
      </Link>
    );
  },
  p({ children }) {
    return <Text>{children}</Text>;
  },
  ul({ children }) {
    return <List as="ul">{children}</List>;
  },
  ol({ children }) {
    return <List as="ol">{children}</List>;
  },
  li({ children }) {
    const nodes = Array.isArray(children) ? children : [children];
    const inlineNodes: ReactNode[] = [];
    const nestedLists: ReactNode[] = [];

    nodes.forEach((node) => {
      if (isValidElement(node) && (node.type === 'ul' || node.type === 'ol')) {
        nestedLists.push(node);
        return;
      }

      inlineNodes.push(node);
    });

    return (
      <li>
        {inlineNodes.length > 0 && <Text>{inlineNodes}</Text>}
        {nestedLists}
      </li>
    );
  },
  h1({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h2({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h3({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h4({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h5({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h6({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  code({ inline, className, children }) {
    if (inline) {
      return <code className={className}>{children}</code>;
    }

    const text = String(children).replace(/\n$/, '');
    const isDiff = className?.includes('language-diff');

    if (isDiff) {
      return <InlineDiff>{text}</InlineDiff>;
    }

    return <CodeBlock code={text} />;
  },
};

export const Markdown: React.FC<{ text: string }> = ({
  text,
}: {
  text: string;
}) => (
  <div className={styles['markdown']}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  </div>
);

/** Reveal text gradually (typewriter) while a turn is answering; show it in full once settled or idle. */
export const useTypewriter = (
  fullText: string,
  streaming: boolean,
  revealing: boolean,
): string => {
  const [shown, setShown] = useState(() => (streaming ? 0 : fullText.length));
  const targetRef = useRef(fullText.length);
  targetRef.current = fullText.length;

  useEffect(() => {
    if (!streaming) {
      setShown(targetRef.current);
      return;
    }
    if (!revealing) {
      setShown(0);
      return;
    }
    const id = setInterval(() => {
      setShown((prev) => {
        const target = targetRef.current;
        if (prev >= target) {
          return prev;
        }
        return Math.min(
          target,
          prev + Math.max(3, Math.ceil((target - prev) / 8)),
        );
      });
    }, 40);
    return () => clearInterval(id);
  }, [streaming, revealing]);

  // Typewrite only while streaming; settled/replayed turns show full text (the reveal effect doesn't re-run as fullText grows, so `shown` stays stale after a reopen).
  return streaming ? fullText.slice(0, shown) : fullText;
};

/** Whole seconds since `startedAt`, re-rendering once a second while `active` (e.g. the live loader). */
export const useElapsedSeconds = (
  active: boolean,
  startedAt?: number,
): number => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return startedAt
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : 0;
};

/** Message parts minus internal plumbing tool calls (deferred-tool loading), before rendering. */
export const visibleParts = (parts: MessagePart[]): MessagePart[] =>
  parts.filter(
    (part) =>
      !(
        part.type === 'tool_call' &&
        INTERNAL_TOOL_TITLES.has(part.toolCall.title)
      ),
  );

const toolCalls = (parts: MessagePart[]): ToolCallData[] =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'tool_call' }> =>
        p.type === 'tool_call',
    )
    .map((p) => p.toolCall);

/** Merges a run's reasoning chunks into one string, so the block shows a single accordion, not a stack. */
export const mergeThinking = (parts: MessagePart[]): string =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'thinking' }> =>
        p.type === 'thinking',
    )
    .map((p) => p.text)
    .join('\n\n');

// "Thought for Xs" from a thinking block's span; "Thought" when timing is unavailable (e.g. replayed history).
export const thoughtLabel = (start?: number, end?: number): string => {
  if (start === undefined || end === undefined) {
    return 'Thought';
  }
  return `Thought for ${Math.max(1, Math.round((end - start) / 1000))}s`;
};

// Min-start / max-end timestamps across a block's thinking parts, for the duration.
export const thinkingSpan = (
  parts: MessagePart[],
): { start?: number; end?: number } => {
  let start: number | undefined;
  let end: number | undefined;
  for (const p of parts) {
    if (p.type !== 'thinking') {
      continue;
    }
    if (p.startedAt !== undefined) {
      start = start === undefined ? p.startedAt : Math.min(start, p.startedAt);
    }
    if (p.endedAt !== undefined) {
      end = end === undefined ? p.endedAt : Math.max(end, p.endedAt);
    }
  }
  return { start, end };
};

/** The plan checklists surfaced in a turn (each rendered as its own card). */
export const checklists = (
  parts: MessagePart[],
): Extract<MessagePart, { type: 'checklist' }>['checklist'][] =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'checklist' }> =>
        p.type === 'checklist',
    )
    .map((p) => p.checklist);

/** The choice questions surfaced in a turn (each rendered as its own card). */
export const choiceRequests = (
  parts: MessagePart[],
): Extract<MessagePart, { type: 'choices' }>['choices'][] =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'choices' }> =>
        p.type === 'choices',
    )
    .map((p) => p.choices);

/** Human answer for a choice (picked option labels + free text), echoed as the user's turn; '' when skipped. */
export const choiceAnswerText = (
  question: Extract<MessagePart, { type: 'choices' }>['choices'],
  submission?: { selectedIds: string[]; other?: string; cancelled?: boolean },
): string => {
  if (!submission || submission.cancelled) {
    return '';
  }
  const labels = submission.selectedIds
    .map((id) => question.options.find((o) => o.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  if (submission.other) {
    labels.push(submission.other);
  }
  return labels.join(', ');
};

/**
 * One render block of a turn, in the order the agent produced it. `activity` is a maximal run of
 * thinking+tool parts (rendered as one Timeline/Thinking block); `text` is a prose run; `checklist`
 * and `choices` are their own cards.
 */
export type MessageSegment =
  | { kind: 'activity'; parts: MessagePart[] }
  | { kind: 'text'; text: string }
  | {
      kind: 'checklist';
      checklist: Extract<MessagePart, { type: 'checklist' }>['checklist'];
    }
  | {
      // One block per elicitation batch: the questions of a single AskUserQuestion, paged as a wizard.
      kind: 'choices';
      choices: Extract<MessagePart, { type: 'choices' }>['choices'][];
    }
  // ExitPlanMode's plan, rendered as a persistent block so it stays in the thread after the approval resolves.
  | { kind: 'plan'; plan: string };

// The plan markdown carried by an ExitPlanMode tool call (ACP kind "switch_mode"), or '' if absent.
export const planFromToolCall = (toolCall: ToolCallData): string => {
  if (toolCall.kind !== 'switch_mode') {
    return '';
  }
  const input = toolCall.input;
  if (
    input &&
    typeof input === 'object' &&
    'plan' in input &&
    typeof (input as { plan: unknown }).plan === 'string'
  ) {
    return (input as { plan: string }).plan;
  }
  return '';
};

// The Write that stages ExitPlanMode's plan file (Claude Code's plans dir) is plumbing — the plan renders as its own block, so this write stays out of the timeline.
const isPlanStagingWrite = (toolCall: ToolCallData): boolean => {
  const input = toolCall.input;
  if (!input || typeof input !== 'object') {
    return false;
  }
  const fp = (input as { file_path?: unknown }).file_path;
  return typeof fp === 'string' && fp.includes('/plans/') && fp.endsWith('.md');
};

/**
 * Groups a turn's parts into ordered segments so narration renders in place: consecutive thinking+tool
 * parts collapse into one activity block, each text run its own block, checklists/choices their own
 * cards — all in agent order. Nothing is dropped (this replaced answerText, which kept only the text
 * after the last tool and so lost any narration written before or between tools).
 */
export const messageSegments = (parts: MessagePart[]): MessageSegment[] => {
  const segments: MessageSegment[] = [];
  let activity: MessagePart[] = [];

  const flushActivity = (): void => {
    if (activity.length > 0) {
      segments.push({ kind: 'activity', parts: activity });
      activity = [];
    }
  };

  for (const part of parts) {
    if (part.type === 'tool_call' && part.toolCall.kind === 'switch_mode') {
      // ExitPlanMode: pull the plan out as its own persistent block, never an activity row.
      const plan = planFromToolCall(part.toolCall);
      if (plan) {
        flushActivity();
        segments.push({ kind: 'plan', plan });
      }
      continue;
    }
    if (part.type === 'tool_call' && isPlanStagingWrite(part.toolCall)) {
      continue;
    }
    if (part.type === 'thinking' || part.type === 'tool_call') {
      activity.push(part);
      continue;
    }
    if (part.type === 'text') {
      // Merge consecutive text chunks (no activity between) into a single block.
      const last = segments[segments.length - 1];
      if (activity.length === 0 && last?.kind === 'text') {
        last.text += `\n\n${part.text}`;
      } else {
        flushActivity();
        segments.push({ kind: 'text', text: part.text });
      }
      continue;
    }
    if (part.type === 'checklist') {
      flushActivity();
      segments.push({ kind: 'checklist', checklist: part.checklist });
      continue;
    }
    if (part.type === 'choices') {
      // Group the questions of one AskUserQuestion (shared batchId) into a single paged block.
      const last = segments[segments.length - 1];
      if (
        activity.length === 0 &&
        last?.kind === 'choices' &&
        part.choices.batchId !== undefined &&
        last.choices[last.choices.length - 1].batchId === part.choices.batchId
      ) {
        last.choices.push(part.choices);
      } else {
        flushActivity();
        segments.push({ kind: 'choices', choices: [part.choices] });
      }
    }
  }
  flushActivity();

  return segments;
};

/** Human summary of a block's tool calls, grouped by kind in first-seen order ("Read 3 files, ran 2 commands"). */
const summarizeActions = (tools: ToolCallData[]): string => {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const t of tools) {
    if (!counts.has(t.kind)) {
      order.push(t.kind);
    }
    counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  }
  const phrases = order.map((kind) => {
    const n = counts.get(kind) ?? 0;
    const p = KIND_PHRASE[kind];
    if (!p) {
      return `${n} ${n === 1 ? 'step' : 'steps'}`;
    }
    return `${p[0]} ${n} ${n === 1 ? p[1] : p[2]}`;
  });
  return phrases
    .map((ph, i) => (i === 0 ? ph : ph.charAt(0).toLowerCase() + ph.slice(1)))
    .join(', ');
};

/**
 * Header summary for an activity block: the current action while streaming, else a human summary of what
 * it did ("Read 3 files, ran 2 commands") — or a generic "Used 1 tool" when it was a single tool (its
 * name shows on expand).
 */
export const activityHeader = (parts: MessagePart[]): string => {
  const tools = toolCalls(parts);
  if (tools.length === 0) {
    return 'Thinking';
  }
  // Single tool: always "Used 1 tool" (even while pending), so it doesn't flip from the bare name once settled.
  if (tools.length === 1) {
    return 'Used 1 tool';
  }
  const active = tools.find(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  );
  if (active) {
    return `${formatToolTitle(active.title)}…`;
  }
  return summarizeActions(tools);
};

/** Label for the live loader: the active tool's phase, else a rotating "thinking" phrase by elapsed time. */
export const currentPhase = (
  parts: MessagePart[],
  elapsedSeconds: number,
): string => {
  const active = toolCalls(parts).find(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  );
  if (active) {
    return PHASE_BY_KIND[active.kind] ?? 'Thinking';
  }
  const idx = Math.min(
    THINKING_PHRASES.length - 1,
    Math.floor(elapsedSeconds / 20),
  );
  return THINKING_PHRASES[idx];
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
): { title: string; file?: TimelineItem['file'] } | undefined => {
  const phrase = KIND_PHRASE[kind];
  if (!phrase || files.length === 0) {
    return undefined;
  }
  const [verb, , plural] = phrase;
  if (files.length > 1) {
    return { title: `${verb} ${files.length} ${plural}` };
  }
  const path = files[0];
  // Drop the mirror root and checkout key, so the row shows 'python/main.py'.
  return {
    title: verb,
    file: { path, label: stripKeyFromPath(path.replace(/\\/g, '/')) },
  };
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
  liveTail = false,
): TimelineItem[] => {
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
      title: live ? 'Thinking' : thoughtLabel(start, end),
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
      const hasOutput =
        (status === 'completed' || status === 'failed') && output !== undefined;
      const fileRow = fileRowLabel(kind, readFiles(part.toolCall));
      items.push({
        id,
        type: TOOL_KIND_TO_TYPE[kind] ?? 'other',
        title:
          fileRow?.title ??
          webToolLabel(kind, part.toolCall.input) ??
          formatToolTitle(title),
        status: timelineStatus(status),
        file: fileRow?.file,
        details: hasOutput ? (
          <pre className={styles['timeline-output']}>
            {stripCodeFence(output)}
          </pre>
        ) : undefined,
      });
    }
  }
  flushReasoning(liveTail);

  if (done) {
    items.push({
      id: 'done',
      type: 'done',
      title: 'Done',
      status: 'completed',
    });
  }

  return items;
};
